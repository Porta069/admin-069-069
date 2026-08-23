"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
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
