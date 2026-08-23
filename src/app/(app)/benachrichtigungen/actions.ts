"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendeMitteilung } from "@/lib/notify";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

export async function markNotificationRead(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("notifications", "view");
    const updated = await sql`
      update admin.notification set read_at = now()
      where id = ${id} and employee_id = ${employee.id} and read_at is null
      returning id`;
    if (updated.length > 0) {
      await recordAudit({
        actorId: employee.id,
        action: "notification.read",
        entityType: "notification",
        entityId: id,
      });
    }
    revalidatePath("/benachrichtigungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(
        e,
        "Benachrichtigung konnte nicht als gelesen markiert werden.",
      ),
    };
  }
}

/**
 * Mitteilung „wahrnehmen" (erledigt) — sie verschwindet sofort aus der Zentrale.
 * Innerhalb von 30 s per undoAcknowledge rückgängig machbar; danach räumt der
 * Sweeper (raeumeWahrgenommeneMitteilungen) die Zeile endgültig aus der DB.
 */
export async function acknowledgeNotification(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("notifications", "view");
    await sql`
      update admin.notification
      set acknowledged_at = now(), read_at = coalesce(read_at, now())
      where id = ${id} and employee_id = ${employee.id} and acknowledged_at is null`;
    revalidatePath("/benachrichtigungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Aktion fehlgeschlagen.") };
  }
}

/** Wahrnehmen rückgängig machen (nur solange die Zeile noch nicht geräumt ist). */
export async function undoAcknowledge(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("notifications", "view");
    const updated = await sql`
      update admin.notification set acknowledged_at = null
      where id = ${id} and employee_id = ${employee.id} and acknowledged_at is not null
      returning id`;
    revalidatePath("/benachrichtigungen");
    if (updated.length === 0) {
      return { ok: false, message: "Zu spät — die Mitteilung wurde bereits geräumt." };
    }
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Rückgängig fehlgeschlagen.") };
  }
}

/** Alle offenen Mitteilungen einer Kategorie (oder alle) wahrnehmen. */
export async function acknowledgeAll(
  kategorie?: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("notifications", "view");
    const updated = await sql`
      update admin.notification
      set acknowledged_at = now(), read_at = coalesce(read_at, now())
      where employee_id = ${employee.id} and acknowledged_at is null
        ${kategorie ? sql`and kategorie = ${kategorie}` : sql``}
      returning id`;
    revalidatePath("/benachrichtigungen");
    return { ok: true, count: updated.length };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Aktion fehlgeschlagen.") };
  }
}

/** Persönliche Mitteilung an einen/mehrere Mitarbeiter senden (mit Entity-Tags). */
export async function sendePersoenlicheMitteilung(input: {
  recipientIds: string[];
  title: string;
  body?: string;
  tags?: { entityType: string; entityId: string }[];
}): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("notifications", "view");
    // Server-seitige Längen-Begrenzung (Client-maxLength ist umgehbar).
    const title = (input.title ?? "").trim().slice(0, 200);
    if (!title) return { ok: false, message: "Bitte einen Betreff eingeben." };
    const body = (input.body ?? "").trim().slice(0, 2000) || null;
    const gewuenscht = [...new Set((input.recipientIds ?? []).filter(Boolean))].filter(
      (id) => id !== employee.id,
    );
    if (gewuenscht.length === 0) {
      return { ok: false, message: "Bitte mindestens einen (anderen) Empfänger wählen." };
    }
    if (gewuenscht.length > 50) {
      return { ok: false, message: "Zu viele Empfänger (max. 50)." };
    }
    // Nur echte, aktive Mitarbeiter als Empfänger zulassen (keine Geister-Zeilen).
    const gueltig = await sql`
      select id from admin.employee
      where id = any(${gewuenscht}::uuid[]) and deleted_at is null and status = 'ACTIVE'`;
    const recipients = gueltig.map((r) => r.id as string);
    if (recipients.length === 0) {
      return { ok: false, message: "Keine gültigen Empfänger." };
    }

    // Nur existierende Kandidaten/Unternehmen als Tags übernehmen.
    const roh = (input.tags ?? []).filter(
      (t) => t.entityType === "candidate" || t.entityType === "company",
    );
    const candIds = roh.filter((t) => t.entityType === "candidate").map((t) => t.entityId);
    const compIds = roh.filter((t) => t.entityType === "company").map((t) => t.entityId);
    const [candEx, compEx] = await Promise.all([
      candIds.length
        ? sql`select id from admin.candidate where id = any(${candIds})`
        : Promise.resolve([] as { id: string }[]),
      compIds.length
        ? sql`select id::text as id from public."Company" where id::text = any(${compIds})`
        : Promise.resolve([] as { id: string }[]),
    ]);
    const gueltigeTags = [
      ...candEx.map((r) => ({ entityType: "candidate", entityId: r.id as string })),
      ...compEx.map((r) => ({ entityType: "company", entityId: r.id as string })),
    ];

    const count = await sendeMitteilung({
      recipientIds: recipients,
      kategorie: "PERSOENLICH",
      type: "PERSOENLICH",
      title,
      body,
      senderId: employee.id,
      tags: gueltigeTags,
    });
    await recordAudit({
      actorId: employee.id,
      action: "notification.personal_sent",
      entityType: "notification",
      metadata: { recipients: recipients.length },
    });
    revalidatePath("/benachrichtigungen");
    return { ok: true, count };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Senden fehlgeschlagen.") };
  }
}

/** Kandidaten/Unternehmen zum Taggen in einer persönlichen Mitteilung suchen. */
export async function sucheTaggbareEntitaeten(q: string): Promise<{
  kandidaten: { id: string; label: string }[];
  unternehmen: { id: string; label: string; hint: string | null }[];
}> {
  const term = (q ?? "").trim();
  if (term.length < 2) return { kandidaten: [], unternehmen: [] };
  const employee = await requirePermission("notifications", "view");
  // Nur suchen, was der Mitarbeiter ohnehin sehen darf (kein Namens-Leak).
  const darfKandidaten = can(employee, "candidates", "view");
  const darfUnternehmen = can(employee, "companies", "view");
  const like = `%${term}%`;
  const [kandidaten, unternehmen] = await Promise.all([
    darfKandidaten
      ? sql`
          select id, "firstName", "lastName" from admin.candidate
          where status <> 'ERASED'
            and (("firstName" || ' ' || "lastName") ilike ${like} or email ilike ${like})
          order by "createdAt" desc limit 8`
      : Promise.resolve([] as Record<string, unknown>[]),
    darfUnternehmen
      ? sql`
          select id, name, ort from public."Company"
          where name ilike ${like} order by name limit 8`
      : Promise.resolve([] as Record<string, unknown>[]),
  ]);
  return {
    kandidaten: kandidaten.map((k) => ({
      id: k.id as string,
      label: `${(k.firstName as string) ?? ""} ${(k.lastName as string) ?? ""}`.trim() || "Kandidat",
    })),
    unternehmen: unternehmen.map((c) => ({
      id: c.id as string,
      label: (c.name as string) ?? "Unternehmen",
      hint: (c.ort as string | null) ?? null,
    })),
  };
}

export async function markAllNotificationsRead(): Promise<
  { ok: true; count: number } | { ok: false; message: string }
> {
  try {
    const employee = await requirePermission("notifications", "view");
    const updated = await sql`
      update admin.notification set read_at = now()
      where employee_id = ${employee.id} and read_at is null
      returning id`;
    if (updated.length > 0) {
      await recordAudit({
        actorId: employee.id,
        action: "notification.read_all",
        entityType: "notification",
        metadata: { count: updated.length },
      });
    }
    revalidatePath("/benachrichtigungen");
    return { ok: true, count: updated.length };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(
        e,
        "Benachrichtigungen konnten nicht als gelesen markiert werden.",
      ),
    };
  }
}
