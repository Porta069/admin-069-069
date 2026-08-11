"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "crypto";
import QRCode from "qrcode";
import { getEmployee, hashPassword, verifyPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  generateIcalToken,
  generateTotpSecret,
  totpKeyUri,
  verifyTotp,
} from "@/lib/security";

type Result<T = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

async function me() {
  const employee = await getEmployee();
  if (!employee) throw new Error("Nicht angemeldet.");
  return employee;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<Result> {
  try {
    const employee = await me();
    if (newPassword.length < 10) {
      return {
        ok: false,
        message: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
      };
    }
    const [row] = await sql`
      select password_hash from admin.employee where id = ${employee.id}`;
    if (!verifyPassword(currentPassword, row.password_hash as string)) {
      return { ok: false, message: "Das aktuelle Passwort ist nicht korrekt." };
    }
    await sql`
      update admin.employee
      set password_hash = ${hashPassword(newPassword)},
          must_change_password = false, updated_at = now()
      where id = ${employee.id}`;

    // Alle anderen Sitzungen beenden — nur die aktuelle bleibt gültig.
    const cookieStore = await cookies();
    const token = cookieStore.get("pw_session")?.value;
    const currentHash = token
      ? crypto.createHash("sha256").update(token).digest("hex")
      : null;
    await sql`
      update admin.session set revoked_at = now()
      where employee_id = ${employee.id} and revoked_at is null
        and token_hash <> ${currentHash ?? ""}`;

    await recordAudit({
      actorId: employee.id,
      action: "employee.password_changed",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Passwortänderung fehlgeschlagen." };
  }
}

export async function startTotpSetupAction(): Promise<
  Result<{ qrDataUrl: string; secret: string }>
> {
  try {
    const employee = await me();
    const secret = generateTotpSecret();
    await sql`
      update admin.employee set totp_secret = ${secret}, updated_at = now()
      where id = ${employee.id} and totp_enabled = false`;
    const uri = totpKeyUri(employee.email, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return { ok: true, qrDataUrl, secret };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "2FA-Einrichtung konnte nicht gestartet werden." };
  }
}

export async function confirmTotpAction(code: string): Promise<Result> {
  try {
    const employee = await me();
    const [row] = await sql`
      select totp_secret from admin.employee where id = ${employee.id}`;
    if (!row?.totp_secret || !(await verifyTotp(row.totp_secret as string, code))) {
      return { ok: false, message: "Der Code ist nicht korrekt — bitte erneut versuchen." };
    }
    await sql`
      update admin.employee set totp_enabled = true, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.totp_enabled",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "2FA-Aktivierung fehlgeschlagen." };
  }
}

export async function disableTotpAction(code: string): Promise<Result> {
  try {
    const employee = await me();
    const [row] = await sql`
      select totp_secret from admin.employee where id = ${employee.id}`;
    if (!row?.totp_secret || !(await verifyTotp(row.totp_secret as string, code))) {
      return { ok: false, message: "Der Code ist nicht korrekt." };
    }
    await sql`
      update admin.employee
      set totp_enabled = false, totp_secret = null, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.totp_disabled",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "2FA-Deaktivierung fehlgeschlagen." };
  }
}

export async function rotateIcalTokenAction(): Promise<Result<{ token: string }>> {
  try {
    const employee = await me();
    const token = generateIcalToken();
    await sql`
      update admin.employee set ical_token = ${token}, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.ical_token_rotated",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true, token };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Kalender-Link konnte nicht erzeugt werden." };
  }
}
