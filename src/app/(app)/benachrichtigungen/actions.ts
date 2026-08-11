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
