import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "crypto";
import { sql } from "./db";
import {
  hasPermission,
  type PermissionAction,
  type PermissionMap,
  type PermissionModule,
} from "./permissions";

const SESSION_COOKIE = "pw_session";
const SESSION_TTL_HOURS = 12;

export interface Employee {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: PermissionMap;
  avatarColor: string;
  team: string | null;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  // Format: scrypt:N:r:p:salthex:hashhex
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, expected] = parts;
  const derived = crypto
    .scryptSync(password, salt, expected.length / 2, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    .toString("hex");
  return `scrypt:16384:8:1:${salt}:${hash}`;
}

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ip, userAgent } = await requestMeta();
  const rows = await sql`
    select e.id, e.password_hash, e.status
    from admin.employee e
    where lower(e.email) = lower(${email}) and e.deleted_at is null
    limit 1`;

  const employee = rows[0];
  const valid =
    employee &&
    employee.status === "ACTIVE" &&
    verifyPassword(password, employee.password_hash as string);

  await sql`
    insert into admin.login_event (employee_id, email, success, ip, user_agent)
    values (${employee?.id ?? null}, ${email}, ${Boolean(valid)}, ${ip}, ${userAgent})`;

  if (!valid) {
    return { ok: false, error: "E-Mail oder Passwort ist nicht korrekt." };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

  await sql`
    insert into admin.session (token_hash, employee_id, ip, user_agent, expires_at)
    values (${sha256(token)}, ${employee.id}, ${ip}, ${userAgent}, ${expiresAt})`;
  await sql`
    update admin.employee set last_login_at = now() where id = ${employee.id}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`
      update admin.session set revoked_at = now()
      where token_hash = ${sha256(token)} and revoked_at is null`;
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Resolve the current employee from the session cookie.
 * Cached per request — safe to call from any server component or action.
 */
export const getEmployee = cache(async (): Promise<Employee | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await sql`
    select e.id, e.email, e.name, e.avatar_color, e.team,
           r.id as role_id, r.name as role_name, r.permissions
    from admin.session s
    join admin.employee e on e.id = s.employee_id and e.deleted_at is null
    join admin.role r on r.id = e.role_id
    where s.token_hash = ${sha256(token)}
      and s.revoked_at is null
      and s.expires_at > now()
      and e.status = 'ACTIVE'
    limit 1`;

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    roleId: row.role_id as string,
    roleName: row.role_name as string,
    permissions: row.permissions as PermissionMap,
    avatarColor: row.avatar_color as string,
    team: (row.team as string) ?? null,
  };
});

/**
 * Server-side gate for pages and actions. Redirects to /login when
 * unauthenticated and to the dashboard when the permission is missing.
 */
export async function requireEmployee(
  module?: PermissionModule,
  action: PermissionAction = "view",
): Promise<Employee> {
  const employee = await getEmployee();
  if (!employee) redirect("/login");
  if (module && !hasPermission(employee.permissions, module, action)) {
    redirect("/?fehlt=" + module);
  }
  return employee;
}

/** Non-redirecting variant for server actions — throws instead. */
export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<Employee> {
  const employee = await getEmployee();
  if (!employee) throw new Error("Nicht angemeldet.");
  if (!hasPermission(employee.permissions, module, action)) {
    throw new Error("Keine Berechtigung für diese Aktion.");
  }
  return employee;
}

export function can(
  employee: Employee,
  module: PermissionModule,
  action: PermissionAction = "view",
): boolean {
  return hasPermission(employee.permissions, module, action);
}
