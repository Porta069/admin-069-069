"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requirePermission, hashPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

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

export interface CreateEmployeeInput {
  name: string;
  email: string;
  roleId: string;
  team: string;
  avatarColor: string;
  password: string;
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

    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) {
      return { ok: false, message: "Bitte einen Namen angeben." };
    }
    if (!EMAIL_RE.test(email)) {
      return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
    }

    const roles = await sql`
      select id from admin.role where id = ${input.roleId} limit 1`;
    if (roles.length === 0) {
      return { ok: false, message: "Die gewählte Rolle existiert nicht." };
    }
    if (input.roleId === "SUPERADMIN" && actor.roleId !== "SUPERADMIN") {
      return {
        ok: false,
        message: "Nur Superadmins dürfen weitere Superadmins anlegen.",
      };
    }

    const existing = await sql`
      select 1 from admin.employee
      where lower(email) = ${email} and deleted_at is null limit 1`;
    if (existing.length > 0) {
      return {
        ok: false,
        message: "Für diese E-Mail-Adresse existiert bereits ein Mitarbeiter.",
      };
    }

    const generated = input.generatePassword ? generatePassword() : null;
    const password = generated ?? input.password;
    if (!password || password.length < 8) {
      return {
        ok: false,
        message: "Das Passwort muss mindestens 8 Zeichen lang sein.",
      };
    }

    const team = input.team.trim() || null;
    const avatarColor = /^#[0-9a-fA-F]{6}$/.test(input.avatarColor)
      ? input.avatarColor
      : "#e8590c";

    const [row] = await sql`
      insert into admin.employee (email, name, password_hash, role_id, status, team, avatar_color)
      values (${email}, ${name}, ${hashPassword(password)}, ${input.roleId}, 'ACTIVE', ${team}, ${avatarColor})
      returning id`;

    await recordAudit({
      actorId: actor.id,
      action: "employee.created",
      entityType: "employee",
      entityId: row.id as string,
      metadata: { email, roleId: input.roleId, team },
    });

    revalidatePath("/mitarbeiter");
    return { ok: true, generatedPassword: generated };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Mitarbeiter konnte nicht angelegt werden."),
    };
  }
}

export async function changeEmployeeRole(
  employeeId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (actor.roleId !== "SUPERADMIN") {
      return { ok: false, message: "Nur Superadmins dürfen Rollen ändern." };
    }
    if (employeeId === actor.id) {
      return {
        ok: false,
        message: "Die eigene Rolle kann nicht geändert werden.",
      };
    }
    const roles = await sql`
      select id from admin.role where id = ${roleId} limit 1`;
    if (roles.length === 0) {
      return { ok: false, message: "Die gewählte Rolle existiert nicht." };
    }
    const [target] = await sql`
      select id, role_id from admin.employee
      where id = ${employeeId} and deleted_at is null limit 1`;
    if (!target) {
      return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    }

    await sql`
      update admin.employee set role_id = ${roleId} where id = ${employeeId}`;
    await recordAudit({
      actorId: actor.id,
      action: "employee.role_changed",
      entityType: "employee",
      entityId: employeeId,
      metadata: { from: target.role_id, to: roleId },
    });

    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Rolle konnte nicht geändert werden."),
    };
  }
}

export async function setEmployeeStatus(
  employeeId: string,
  status: "ACTIVE" | "DISABLED",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return {
        ok: false,
        message: "Der eigene Account kann nicht deaktiviert werden.",
      };
    }
    if (status !== "ACTIVE" && status !== "DISABLED") {
      return { ok: false, message: "Ungültiger Status." };
    }
    const [target] = await sql`
      select id from admin.employee
      where id = ${employeeId} and deleted_at is null limit 1`;
    if (!target) {
      return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    }

    await sql`
      update admin.employee set status = ${status} where id = ${employeeId}`;
    if (status === "DISABLED") {
      await sql`
        update admin.session set revoked_at = now()
        where employee_id = ${employeeId} and revoked_at is null`;
    }
    await recordAudit({
      actorId: actor.id,
      action:
        status === "DISABLED" ? "employee.deactivated" : "employee.activated",
      entityType: "employee",
      entityId: employeeId,
      metadata: { status },
    });

    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Status konnte nicht geändert werden."),
    };
  }
}

export async function resetEmployeePassword(
  employeeId: string,
): Promise<{ ok: true; password: string } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "edit");
    if (employeeId === actor.id) {
      return {
        ok: false,
        message:
          "Das eigene Passwort kann hier nicht zurückgesetzt werden.",
      };
    }
    const [target] = await sql`
      select id from admin.employee
      where id = ${employeeId} and deleted_at is null limit 1`;
    if (!target) {
      return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    }

    const password = generatePassword();
    await sql`
      update admin.employee set password_hash = ${hashPassword(password)}
      where id = ${employeeId}`;
    await recordAudit({
      actorId: actor.id,
      action: "employee.password_reset",
      entityType: "employee",
      entityId: employeeId,
    });

    revalidatePath("/mitarbeiter");
    return { ok: true, password };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Passwort konnte nicht zurückgesetzt werden."),
    };
  }
}

export async function deleteEmployee(
  employeeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("employees", "delete");
    if (actor.roleId !== "SUPERADMIN") {
      return {
        ok: false,
        message: "Nur Superadmins dürfen Mitarbeiter löschen.",
      };
    }
    if (employeeId === actor.id) {
      return {
        ok: false,
        message: "Der eigene Account kann nicht gelöscht werden.",
      };
    }
    const [target] = await sql`
      select id, email from admin.employee
      where id = ${employeeId} and deleted_at is null limit 1`;
    if (!target) {
      return { ok: false, message: "Mitarbeiter wurde nicht gefunden." };
    }

    await sql`
      update admin.employee set deleted_at = now(), status = 'DISABLED'
      where id = ${employeeId}`;
    await sql`
      update admin.session set revoked_at = now()
      where employee_id = ${employeeId} and revoked_at is null`;
    await recordAudit({
      actorId: actor.id,
      action: "employee.deleted",
      entityType: "employee",
      entityId: employeeId,
      metadata: { email: target.email },
    });

    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Mitarbeiter konnte nicht gelöscht werden."),
    };
  }
}
