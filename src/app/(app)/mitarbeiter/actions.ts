"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePermission, hashPassword, type Employee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  isFullAccess,
  permissionsSubsetOf,
  buildPermissionMap,
} from "@/lib/rbac";
import type { PermissionMap } from "@/lib/permissions";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

function generatePassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,40}$/;

/** Passwort-Mindestanforderung: ≥10 Zeichen, Buchstabe + Ziffer. */
function passwortSchwach(pw: string): string | null {
  if (!pw || pw.length < 10) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw))
    return "Das Passwort muss Buchstaben und Ziffern enthalten.";
  return null;
}

// ── Hierarchie / Escalation ──────────────────────────────────────────────────

/** Darf der Handelnde ein Konto mit dieser Rollen-Stufe verwalten? */
function darfVerwalten(actor: Employee, targetLevel: number): boolean {
  if (isFullAccess(actor.permissions)) return true; // Master
  return actor.roleLevel > targetLevel;
}

/** Darf der Handelnde diese Rolle vergeben (nie ≥ eigene Stufe, außer Master)? */
function darfRolleVergeben(
  actor: Employee,
  role: { id: string; level: number },
): boolean {
  if (role.id === "SUPERADMIN") return actor.roleLevel >= 100;
  if (isFullAccess(actor.permissions)) return true;
  return actor.roleLevel > role.level;
}

async function ladeRolle(roleId: string) {
  const [r] = await sql`
    select id, level, permissions from admin.role where id = ${roleId} limit 1`;
  return r as { id: string; level: number; permissions: PermissionMap } | undefined;
}

async function ladeZiel(employeeId: string) {
  const [t] = await sql`
    select e.id, e.email, e.role_id, e.permission_overrides, r.level
    from admin.employee e join admin.role r on r.id = e.role_id
    where e.id = ${employeeId} and e.deleted_at is null limit 1`;
  return t as
    | { id: string; email: string; role_id: string; permission_overrides: PermissionMap | null; level: number }
    | undefined;
}

// ── Mitarbeiter anlegen ──────────────────────────────────────────────────────

export interface CreateEmployeeInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string;
  phone?: string;
  roleId: string;
  team: string;
  avatarColor: string;
  password: string;
  passwordConfirm?: string;
  generatePassword: boolean;
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<
  | { ok: true; generatedPassword: string | null }
  | { ok: false; message: string }
> {
  try {
    const actor = await requirePermission("employees", "create");

    const first = (input.firstName ?? "").trim();
    const last = (input.lastName ?? "").trim();
    const name = (input.name ?? `${first} ${last}`).trim();
    if (name.length < 2) return { ok: false, message: "Bitte einen Namen angeben." };

    const email = input.email.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
    }

    const username = (input.username ?? "").trim().toLowerCase();
    if (!username || !USERNAME_RE.test(username)) {
      return {
        ok: false,
        message: "Bitte einen gültigen Username angeben (Kleinbuchstaben, Zahlen, . _ -, min. 3 Zeichen).",
      };
    }

    const role = await ladeRolle(input.roleId);
    if (!role) return { ok: false, message: "Die gewählte Rolle existiert nicht." };
    if (!darfRolleVergeben(actor, role)) {
      return {
        ok: false,
        message: "Du darfst keine Rolle mit gleich hoher oder höherer Berechtigungsstufe vergeben.",
      };
    }

    const dup = await sql`
      select 1 from admin.employee
      where deleted_at is null
        and (lower(username) = ${username} ${email ? sql`or lower(email) = ${email}` : sql``})
      limit 1`;
    if (dup.length > 0) {
      return { ok: false, message: "Username oder E-Mail-Adresse ist bereits vergeben." };
    }

    const generated = input.generatePassword ? generatePassword() : null;
    const password = generated ?? input.password;
    if (!generated) {
      const schwach = passwortSchwach(password);
      if (schwach) return { ok: false, message: schwach };
      if (input.passwordConfirm !== undefined && input.passwordConfirm !== password) {
        return { ok: false, message: "Die Passwörter stimmen nicht überein." };
      }
    }

    const team = input.team.trim() || null;
    const avatarColor = /^#[0-9a-fA-F]{6}$/.test(input.avatarColor) ? input.avatarColor : "#e8590c";

    const [row] = await sql`
      insert into admin.employee
        (email, username, name, first_name, last_name, phone, password_hash,
         role_id, status, team, avatar_color, must_change_password, created_by)
      values (${email || null}, ${username}, ${name}, ${first || null}, ${last || null},
              ${input.phone?.trim() || null}, ${hashPassword(password)}, ${input.roleId},
              'ACTIVE', ${team}, ${avatarColor}, true, ${actor.id})
      returning id`;

    await recordAudit({
      actorId: actor.id, action: "employee.created", entityType: "employee",
      entityId: row.id as string, metadata: { username, email, roleId: input.roleId, team },
    });

    revalidatePath("/mitarbeiter");
    return { ok: true, generatedPassword: generated };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Mitarbeiter konnte nicht angelegt werden.") };
  }
}

// ── Profil bearbeiten ────────────────────────────────────────────────────────

export async function updateEmployeeProfile(
  employeeId: string,
  data: { firstName?: string; lastName?: string; email?: string; phone?: string; team?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    if (employeeId !== actor.id && !darfVerwalten(actor, target.level)) {
      return { ok: false, message: "Keine Berechtigung, dieses Konto zu bearbeiten." };
    }
    const email = (data.email ?? "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
    }
    const first = (data.firstName ?? "").trim();
    const last = (data.lastName ?? "").trim();
    const name = `${first} ${last}`.trim();
    await sql`
      update admin.employee set
        first_name = ${first || null}, last_name = ${last || null},
        ${name.length >= 2 ? sql`name = ${name},` : sql``}
        ${email ? sql`email = ${email},` : sql``}
        phone = ${data.phone?.trim() || null}, team = ${data.team?.trim() || null},
        updated_at = now()
      where id = ${employeeId}`;
    await recordAudit({
      actorId: actor.id, action: "employee.profile_updated",
      entityType: "employee", entityId: employeeId,
    });
    revalidatePath(`/mitarbeiter/${employeeId}`);
    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Profil konnte nicht gespeichert werden.") };
  }
}

// ── Rolle / Template wechseln ────────────────────────────────────────────────

export async function changeEmployeeRole(
  employeeId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return { ok: false, message: "Die eigene Rolle kann nicht geändert werden." };
    }
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    if (!darfVerwalten(actor, target.level)) {
      return { ok: false, message: "Keine Berechtigung, dieses Konto zu verwalten." };
    }
    const role = await ladeRolle(roleId);
    if (!role) return { ok: false, message: "Die gewählte Rolle existiert nicht." };
    if (!darfRolleVergeben(actor, role)) {
      return { ok: false, message: "Du darfst keine Rolle mit gleich hoher oder höherer Stufe vergeben." };
    }
    // Rollenwechsel setzt individuelle Overrides zurück (Konto folgt wieder Template).
    await sql`
      update admin.employee set role_id = ${roleId}, permission_overrides = null, updated_at = now()
      where id = ${employeeId}`;
    await recordAudit({
      actorId: actor.id, action: "employee.role_changed", entityType: "employee",
      entityId: employeeId, metadata: { from: target.role_id, to: roleId },
    });
    revalidatePath("/mitarbeiter");
    revalidatePath(`/mitarbeiter/${employeeId}`);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Rolle konnte nicht geändert werden.") };
  }
}

// ── Individuelle Berechtigungen ──────────────────────────────────────────────

export async function updateEmployeePermissions(
  employeeId: string,
  mode: "template" | "custom",
  selection?: Record<string, string[]>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return { ok: false, message: "Die eigenen Berechtigungen können hier nicht geändert werden." };
    }
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    if (!darfVerwalten(actor, target.level)) {
      return { ok: false, message: "Keine Berechtigung, dieses Konto zu verwalten." };
    }

    if (mode === "template") {
      await sql`
        update admin.employee set permission_overrides = null, updated_at = now()
        where id = ${employeeId}`;
      await recordAudit({
        actorId: actor.id, action: "employee.permissions_reset_to_template",
        entityType: "employee", entityId: employeeId,
      });
    } else {
      const map = buildPermissionMap(selection ?? {});
      // Escalation-Schutz: nur Rechte, die der Handelnde selbst besitzt.
      if (!permissionsSubsetOf(map, actor.permissions)) {
        return {
          ok: false,
          message: "Du kannst nur Berechtigungen vergeben, die du selbst besitzt.",
        };
      }
      await sql`
        update admin.employee set permission_overrides = ${sql.json(map as never)}, updated_at = now()
        where id = ${employeeId}`;
      await recordAudit({
        actorId: actor.id, action: "employee.permissions_changed",
        entityType: "employee", entityId: employeeId, metadata: { modules: Object.keys(map) },
      });
    }
    revalidatePath(`/mitarbeiter/${employeeId}`);
    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Berechtigungen konnten nicht gespeichert werden.") };
  }
}

// ── Status / Passwort / Löschen ──────────────────────────────────────────────

export async function setEmployeeStatus(
  employeeId: string,
  status: "ACTIVE" | "DISABLED" | "LOCKED",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return { ok: false, message: "Der eigene Account kann nicht geändert werden." };
    }
    if (!["ACTIVE", "DISABLED", "LOCKED"].includes(status)) {
      return { ok: false, message: "Ungültiger Status." };
    }
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    if (!darfVerwalten(actor, target.level)) {
      return { ok: false, message: "Keine Berechtigung, dieses Konto zu verwalten." };
    }
    await sql`update admin.employee set status = ${status}, updated_at = now() where id = ${employeeId}`;
    if (status !== "ACTIVE") {
      await sql`
        update admin.session set revoked_at = now()
        where employee_id = ${employeeId} and revoked_at is null`;
    }
    await recordAudit({
      actorId: actor.id,
      action: status === "ACTIVE" ? "employee.activated"
        : status === "LOCKED" ? "employee.locked" : "employee.deactivated",
      entityType: "employee", entityId: employeeId, metadata: { status },
    });
    revalidatePath("/mitarbeiter");
    revalidatePath(`/mitarbeiter/${employeeId}`);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Status konnte nicht geändert werden.") };
  }
}

export async function resetEmployeePassword(
  employeeId: string,
): Promise<{ ok: true; password: string } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return { ok: false, message: "Das eigene Passwort kann hier nicht zurückgesetzt werden." };
    }
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    if (!darfVerwalten(actor, target.level)) {
      return { ok: false, message: "Keine Berechtigung, dieses Konto zu verwalten." };
    }
    const password = generatePassword();
    await sql`
      update admin.employee set password_hash = ${hashPassword(password)},
        must_change_password = true, updated_at = now()
      where id = ${employeeId}`;
    // Aktive Sitzungen des Zielkontos beenden — ein evtl. Angreifer mit alter
    // Sitzung wird sofort ausgesperrt, nicht erst nach 24 h.
    await sql`
      update admin.session set revoked_at = now()
      where employee_id = ${employeeId} and revoked_at is null`;
    await recordAudit({
      actorId: actor.id, action: "employee.password_reset",
      entityType: "employee", entityId: employeeId,
    });
    revalidatePath("/mitarbeiter");
    return { ok: true, password };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Passwort konnte nicht zurückgesetzt werden.") };
  }
}

export async function deleteEmployee(
  employeeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "delete");
    // Löschen ist ausschließlich dem Master-Account vorbehalten.
    if (!isFullAccess(actor.permissions)) {
      return { ok: false, message: "Mitarbeiter können nur über den Master-Account gelöscht werden." };
    }
    if (employeeId === actor.id) {
      return { ok: false, message: "Der eigene Account kann nicht gelöscht werden." };
    }
    const target = await ladeZiel(employeeId);
    if (!target) return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    await sql`
      update admin.employee set deleted_at = now(), status = 'DISABLED', updated_at = now()
      where id = ${employeeId}`;
    await sql`
      update admin.session set revoked_at = now()
      where employee_id = ${employeeId} and revoked_at is null`;
    await recordAudit({
      actorId: actor.id, action: "employee.deleted", entityType: "employee",
      entityId: employeeId, metadata: { email: target.email },
    });
    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Mitarbeiter konnte nicht gelöscht werden.") };
  }
}
