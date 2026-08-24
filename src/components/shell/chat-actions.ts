"use server";

import { requireEmployee } from "@/lib/auth";
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

export type ChatTag = { entityType: string; entityId: string; label?: string };

/**
 * Chat-Nachricht an einen anderen Mitarbeiter senden. Getaggte Nutzer/Unternehmen
 * erscheinen zusätzlich in deren Kommunikations-Historie (MITTEILUNG/INTERN) —
 * gleiches Prinzip wie bei den persönlichen Mitteilungen.
 */
export async function sendeChatNachricht(input: {
  recipientId: string;
  body: string;
  tags?: ChatTag[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await requireEmployee();
    const body = (input.body ?? "").trim().slice(0, 4000);
    if (!body) return { ok: false, message: "Leere Nachricht." };
    const recipientId = (input.recipientId ?? "").trim();
    if (!recipientId || recipientId === employee.id) {
      return { ok: false, message: "Ungültiger Empfänger." };
    }

    const [gueltig] = await sql`
      select id, name from admin.employee
      where id = ${recipientId}::uuid and deleted_at is null and status = 'ACTIVE'
      limit 1`;
    if (!gueltig) return { ok: false, message: "Empfänger nicht gefunden." };

    // Nur existierende Kandidaten/Unternehmen als Tags übernehmen (+ Labels).
    const roh = (input.tags ?? []).filter(
      (t) => t.entityType === "candidate" || t.entityType === "company",
    );
    const candIds = roh.filter((t) => t.entityType === "candidate").map((t) => t.entityId);
    const compIds = roh.filter((t) => t.entityType === "company").map((t) => t.entityId);
    const [candEx, compEx] = await Promise.all([
      candIds.length
        ? sql`select id, ("firstName" || ' ' || "lastName") as label
               from admin.candidate where id = any(${candIds})`
        : Promise.resolve([] as Record<string, unknown>[]),
      compIds.length
        ? sql`select id::text as id, name as label from public."Company"
               where id::text = any(${compIds})`
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);
    const gueltigeTags: ChatTag[] = [
      ...candEx.map((r) => ({
        entityType: "candidate",
        entityId: r.id as string,
        label: ((r.label as string) ?? "").trim() || "Kandidat",
      })),
      ...compEx.map((r) => ({
        entityType: "company",
        entityId: r.id as string,
        label: (r.label as string) ?? "Unternehmen",
      })),
    ];

    await sql`
      insert into admin.chat_message (sender_id, recipient_id, body, tags)
      values (${employee.id}, ${recipientId}::uuid, ${body}, ${sql.json(gueltigeTags)})`;

    // Getaggte Entitäten → Kommunikations-Historie.
    if (gueltigeTags.length > 0) {
      const et = gueltigeTags.map((t) => t.entityType);
      const eid = gueltigeTags.map((t) => t.entityId);
      const subject = `Chat mit ${gueltig.name as string}: ${body}`.slice(0, 200);
      await sql`
        insert into admin.communication
          (channel, direction, subject, body, entity_type, entity_id, employee_id, occurred_at)
        select 'MITTEILUNG', 'INTERN', ${subject}, ${body}, tt.et, tt.eid, ${employee.id}, now()
        from unnest(${et}::text[], ${eid}::text[]) as tt(et, eid)`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "chat.message_sent",
      entityType: "employee",
      entityId: recipientId,
      metadata: { tags: gueltigeTags.length },
    });

    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: errorMessage(e, "Senden fehlgeschlagen.") };
  }
}
