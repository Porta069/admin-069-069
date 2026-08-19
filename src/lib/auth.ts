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
// Rollierendes 24-Stunden-Fenster: Bei jeder Aktivität wird die Sitzung wieder
// auf 24 h verlängert. Man bleibt also eingeloggt, solange man das Dashboard
// mindestens alle 24 h nutzt — beendet wird nur durch aktives Ausloggen oder
// 24 h Inaktivität. Der Cookie ist ein langlebiger Container; das eigentliche
// Gate ist admin.session.expires_at in der DB (jederzeit widerrufbar).
const SESSION_TTL_HOURS = 24;
const SESSION_COOKIE_DAYS = 30;

// scrypt-Kostenparameter (aktuell). N wird im Hash gespeichert, ältere Hashes
// bleiben verifizierbar und werden beim nächsten Login opportunistisch angehoben.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 96 * 1024 * 1024;

/**
 * Rollen, für die 2FA VERPFLICHTEND ist. Leer = 2FA ist optional (empfohlen,
 * jederzeit unter Konto → Sicherheit aktivierbar), blockiert aber nicht den
 * Zugang zum Dashboard. Zum Erzwingen einfach Rollen eintragen, z. B.
 * new Set(["SUPERADMIN", "ADMIN"]).
 */
const ZWEI_FAKTOR_ROLLEN = new Set<string>([]);
function rolleBrauchtZweiFaktor(roleId: string): boolean {
  return ZWEI_FAKTOR_ROLLEN.has(roleId);
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: PermissionMap;
  avatarColor: string;
  team: string | null;
  mustChangePassword: boolean;
  totpEnabled: boolean;
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
      maxmem: SCRYPT_MAXMEM,
    })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    })
    .toString("hex");
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
}

/** Hash mit veralteten Kostenparametern → beim nächsten Login neu hashen. */
function needsRehash(stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < SCRYPT_N;
}

/**
 * Fester Dummy-Hash, gegen den bei unbekanntem/inaktivem Konto geprüft wird,
 * damit die Antwortzeit dieselbe ist wie bei echten Konten (keine Enumeration).
 */
const DUMMY_HASH = hashPassword("pw-timing-equalizer-kein-echtes-konto");

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
  totpCode?: string,
): Promise<
  | { ok: true; mustChangePassword: boolean }
  | { ok: false; error: string; needsTotp?: boolean }
> {
  const { ip, userAgent } = await requestMeta();

  const { istIpGesperrt, istEmailGesperrt, verifyTotp } = await import(
    "./security"
  );

  // IP-Drosselung: bei zu vielen Fehlversuchen sofort blocken (spart auch die
  // teure scrypt-Berechnung) und den Versuch zählen.
  if (await istIpGesperrt(ip)) {
    await sql`
      insert into admin.login_event (employee_id, email, success, ip, user_agent)
      values (null, ${email}, false, ${ip}, ${userAgent})`;
    return {
      ok: false,
      error:
        "Zu viele Fehlversuche von dieser Verbindung. Bitte in 15 Minuten erneut versuchen.",
    };
  }

  const rows = await sql`
    select e.id, e.password_hash, e.status, e.totp_enabled, e.totp_secret,
           e.must_change_password
    from admin.employee e
    where lower(e.email) = lower(${email}) and e.deleted_at is null
    limit 1`;

  const employee = rows[0];
  const usable = Boolean(
    employee && employee.status === "ACTIVE" && employee.password_hash,
  );
  // Immer scrypt ausführen — gegen echten Hash oder Dummy — damit die Laufzeit
  // bei unbekanntem/inaktivem Konto identisch ist (keine Timing-Enumeration).
  const passwordValid =
    verifyPassword(
      password,
      usable ? (employee.password_hash as string) : DUMMY_HASH,
    ) && usable;

  // 2FA: Passwort korrekt, aber Code fehlt → zweiter Schritt, kein Fehlversuch.
  if (passwordValid && employee.totp_enabled && !totpCode) {
    return { ok: false, needsTotp: true, error: "" };
  }

  let totpValid = true;
  if (usable && employee.totp_enabled) {
    totpValid =
      Boolean(totpCode) &&
      (await verifyTotp(employee.totp_secret as string, totpCode as string));
  }

  const valid = Boolean(passwordValid && totpValid);

  await sql`
    insert into admin.login_event (employee_id, email, success, ip, user_agent)
    values (${employee?.id ?? null}, ${email}, ${valid}, ${ip}, ${userAgent})`;

  if (!valid) {
    if (passwordValid && !totpValid) {
      return {
        ok: false,
        needsTotp: true,
        error: "Der 2FA-Code ist nicht korrekt.",
      };
    }
    // Konto-Sperre greift NUR hier (falsche Zugangsdaten) — ein korrektes
    // Passwort wird oben nie geblockt, daher kein Aussperr-DoS für Kollegen.
    if (await istEmailGesperrt(email)) {
      return {
        ok: false,
        error: "Zu viele Fehlversuche. Der Login ist für 15 Minuten gesperrt.",
      };
    }
    return { ok: false, error: "E-Mail oder Passwort ist nicht korrekt." };
  }

  // Opportunistisches Rehashing auf aktuelle Kostenparameter.
  if (needsRehash(employee.password_hash as string)) {
    try {
      await sql`
        update admin.employee set password_hash = ${hashPassword(password)}
        where id = ${employee.id}`;
    } catch (e) {
      console.error("Rehash fehlgeschlagen", e);
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

  await sql`
    insert into admin.session (token_hash, employee_id, ip, user_agent, expires_at)
    values (${sha256(token)}, ${employee.id}, ${ip}, ${userAgent}, ${expiresAt})`;
  await sql`
    update admin.employee set last_login_at = now() where id = ${employee.id}`;

  // Cookie lebt länger als das 24h-DB-Fenster (Container); die rollierende
  // DB-Sitzung ist das eigentliche Gate. So übersteht der Login auch einen
  // Browser-Neustart, solange innerhalb von 24 h weitergearbeitet wird.
  const cookieExpires = new Date(
    Date.now() + SESSION_COOKIE_DAYS * 24 * 3600 * 1000,
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: cookieExpires,
  });

  return {
    ok: true,
    mustChangePassword: Boolean(employee.must_change_password),
  };
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
           e.must_change_password, e.totp_enabled,
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

  // Rollierende Sitzung: bei Aktivität wieder auf volle 24 h setzen. Gedrosselt
  // — nur verlängern, wenn weniger als (TTL−1) h übrig sind (höchstens ~1×/Stunde
  // ein DB-Write). Aktives Ausloggen (revoked_at) und Deaktivierung greifen sofort.
  await sql`
    update admin.session
    set expires_at = now() + (${SESSION_TTL_HOURS} || ' hours')::interval
    where token_hash = ${sha256(token)} and revoked_at is null
      and expires_at < now() + (${SESSION_TTL_HOURS - 1} || ' hours')::interval`;

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    roleId: row.role_id as string,
    roleName: row.role_name as string,
    permissions: row.permissions as PermissionMap,
    avatarColor: row.avatar_color as string,
    team: (row.team as string) ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    totpEnabled: Boolean(row.totp_enabled),
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

  // Pflicht-Gates (Passwort setzen, 2FA für Admins) — außer auf der Konto-Seite
  // selbst, damit sie dort erfüllt werden können.
  const path = (await headers()).get("x-pathname") ?? "";
  if (!path.startsWith("/konto")) {
    if (employee.mustChangePassword) redirect("/konto?erst=1");
    if (rolleBrauchtZweiFaktor(employee.roleId) && !employee.totpEnabled) {
      redirect("/konto?2fa=1");
    }
  }

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
  // Pflicht-Gates hart durchsetzen (nicht nur als Seiten-Redirect): ein Konto,
  // das das Passwort ändern oder 2FA einrichten muss, darf keine mutierenden
  // Actions ausführen. Die Konto-Selbstverwaltung nutzt getEmployee, nicht diese
  // Funktion, und bleibt daher erreichbar.
  if (employee.mustChangePassword) {
    throw new Error("Bitte zuerst dein Passwort ändern (Konto → Sicherheit).");
  }
  if (rolleBrauchtZweiFaktor(employee.roleId) && !employee.totpEnabled) {
    throw new Error(
      "Zwei-Faktor-Authentifizierung ist für deine Rolle erforderlich (Konto → Sicherheit).",
    );
  }
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
