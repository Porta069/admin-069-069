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
import {
  AVATAR_MAX_BYTES,
  avatarStorageAktiv,
  deleteAvatarObject,
  uploadAvatar,
} from "@/lib/storage";
import { sendeNtfy } from "@/lib/ntfy";
import { PUSH_GRUPPEN_KEYS } from "@/lib/ntfy-groups";

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
    // Versehentliche Leerzeichen am Anfang/Ende ignorieren (wie beim Login).
    const aktuell = currentPassword.trim();
    const neu = newPassword.trim();
    if (neu.length < 10) {
      return {
        ok: false,
        message: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
      };
    }
    const [row] = await sql`
      select password_hash from admin.employee where id = ${employee.id}`;
    if (!verifyPassword(aktuell, row.password_hash as string)) {
      return { ok: false, message: "Das aktuelle Passwort ist nicht korrekt." };
    }
    await sql`
      update admin.employee
      set password_hash = ${hashPassword(neu)},
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
    // Auch die Mitarbeiter-Ansicht auffrischen, damit das „Passwortänderung
    // ausstehend"-Kennzeichen für dieses Konto verschwindet.
    revalidatePath("/mitarbeiter", "layout");
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

/** Handy-Benachrichtigungen (ntfy) aktivieren — erzeugt einen geheimen Topic. */
export async function enableNtfyAction(): Promise<Result<{ topic: string }>> {
  try {
    const employee = await me();
    const [row] = await sql`select ntfy_topic from admin.employee where id = ${employee.id}`;
    const topic =
      (row?.ntfy_topic as string | null) ||
      `werkpair-${crypto.randomBytes(9).toString("hex")}`;
    await sql`
      update admin.employee set ntfy_topic = ${topic}, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.ntfy_enabled",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true, topic };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Handy-Benachrichtigungen konnten nicht aktiviert werden." };
  }
}

/** Handy-Benachrichtigungen deaktivieren (Topic entfernen). */
export async function disableNtfyAction(): Promise<Result> {
  try {
    const employee = await me();
    await sql`
      update admin.employee set ntfy_topic = null, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.ntfy_disabled",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Deaktivierung fehlgeschlagen." };
  }
}

/** Test-Push auf das Handy senden — für Schritt 4 der Einrichtung. */
export async function sendeNtfyTestAction(): Promise<Result> {
  try {
    const employee = await me();
    const [row] = await sql`select ntfy_topic from admin.employee where id = ${employee.id}`;
    const topic = row?.ntfy_topic as string | null;
    if (!topic) {
      return { ok: false, message: "Bitte zuerst Handy-Benachrichtigungen aktivieren." };
    }
    await sendeNtfy(topic, {
      title: "✅ Werkpair-Test",
      body: "Super — dein Handy ist verbunden. Ab jetzt bekommst du hier Benachrichtigungen.",
      priority: "HOCH",
    });
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Test-Push fehlgeschlagen." };
  }
}

/** Handy-Push-Präferenzen speichern (welche Gruppen aufs Handy sollen). */
export async function saveNtfyPrefsAction(
  prefs: Record<string, boolean>,
): Promise<Result> {
  try {
    const employee = await me();
    // Nur bekannte Gruppen-Keys übernehmen, alles als echtes Boolean.
    const sauber: Record<string, boolean> = {};
    for (const key of PUSH_GRUPPEN_KEYS) {
      sauber[key] = prefs?.[key] !== false;
    }
    await sql`
      update admin.employee set ntfy_prefs = ${sql.json(sauber)}, updated_at = now()
      where id = ${employee.id}`;
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Einstellungen konnten nicht gespeichert werden." };
  }
}

/**
 * Benutzernamen des eigenen Kontos ändern. Der Login läuft über die E-Mail —
 * der Benutzername ist ein eindeutiges Handle (case-insensitive eindeutig).
 */
export async function updateUsernameAction(input: {
  username: string;
}): Promise<Result> {
  try {
    const employee = await me();
    const username = (input.username ?? "").trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      return {
        ok: false,
        message: "Benutzername: 3–40 Zeichen, nur Buchstaben, Ziffern sowie . _ -",
      };
    }
    const konflikt = await sql`
      select 1 from admin.employee
      where lower(username) = lower(${username})
        and id <> ${employee.id} and deleted_at is null
      limit 1`;
    if (konflikt.length > 0) {
      return { ok: false, message: "Dieser Benutzername ist bereits vergeben." };
    }
    await sql`
      update admin.employee set username = ${username}, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.username_changed",
      entityType: "employee",
      entityId: employee.id,
      metadata: { username },
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: "Benutzername konnte nicht geändert werden (evtl. bereits vergeben).",
    };
  }
}

/** Anzeigename, Vor-/Nachname und Telefon des eigenen Kontos aktualisieren. */
export async function updateProfileAction(input: {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<Result> {
  try {
    const employee = await me();
    const name = input.name.trim();
    if (name.length < 2) {
      return { ok: false, message: "Bitte einen Anzeigenamen (mind. 2 Zeichen) angeben." };
    }
    const firstName = input.firstName.trim() || null;
    const lastName = input.lastName.trim() || null;
    const phone = input.phone.trim() || null;
    if (phone && !/^[+0-9 ()/-]{5,32}$/.test(phone)) {
      return { ok: false, message: "Die Telefonnummer sieht ungültig aus." };
    }
    await sql`
      update admin.employee
      set name = ${name}, first_name = ${firstName}, last_name = ${lastName},
          phone = ${phone}, updated_at = now()
      where id = ${employee.id}`;
    await recordAudit({
      actorId: employee.id,
      action: "employee.profile_updated",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Profil konnte nicht gespeichert werden." };
  }
}

/** Profilbild hochladen (FormData-Feld "file"). */
export async function uploadAvatarAction(formData: FormData): Promise<Result<{ url: string }>> {
  try {
    const employee = await me();
    if (!avatarStorageAktiv()) {
      return { ok: false, message: "Bild-Speicher ist nicht konfiguriert (SUPABASE-Keys fehlen)." };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Bitte eine Bilddatei auswählen." };
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { ok: false, message: "Nur JPG, PNG oder WebP werden unterstützt." };
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return { ok: false, message: "Das Bild ist zu groß (max. 3 MB)." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Ohne Date.now() in der Aktion? Zeitstempel ist hier zulässig (kein Cache-Prefix).
    const stamp = Date.now();
    const url = await uploadAvatar(employee.id, bytes, file.type, stamp);
    if (!url) {
      return { ok: false, message: "Upload fehlgeschlagen — bitte erneut versuchen." };
    }
    const [prev] = await sql`
      select avatar_url from admin.employee where id = ${employee.id}`;
    await sql`
      update admin.employee set avatar_url = ${url}, updated_at = now()
      where id = ${employee.id}`;
    // Altes Objekt best-effort entfernen (nur wenn ein anderer Key).
    const old = (prev?.avatar_url as string | null) ?? null;
    if (old && old !== url) await deleteAvatarObject(old);

    await recordAudit({
      actorId: employee.id,
      action: "employee.avatar_updated",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    revalidatePath("/mitarbeiter");
    return { ok: true, url };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bild konnte nicht hochgeladen werden." };
  }
}

/** Profilbild entfernen. */
export async function removeAvatarAction(): Promise<Result> {
  try {
    const employee = await me();
    const [prev] = await sql`
      select avatar_url from admin.employee where id = ${employee.id}`;
    await sql`
      update admin.employee set avatar_url = null, updated_at = now()
      where id = ${employee.id}`;
    await deleteAvatarObject((prev?.avatar_url as string | null) ?? null);
    await recordAudit({
      actorId: employee.id,
      action: "employee.avatar_removed",
      entityType: "employee",
      entityId: employee.id,
    });
    revalidatePath("/konto");
    revalidatePath("/mitarbeiter");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bild konnte nicht entfernt werden." };
  }
}
