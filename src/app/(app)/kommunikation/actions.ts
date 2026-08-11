"use server";

import { parseBerlinLocal } from "@/lib/format";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; message: string };

const CHANNELS = ["EMAIL", "TELEFON", "WHATSAPP", "SONSTIGE"];
const DIRECTIONS = ["INBOUND", "OUTBOUND"];

export async function logCommunication(input: {
  channel: string;
  direction: string;
  subject: string;
  body: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "create");
    if (!CHANNELS.includes(input.channel))
      return { ok: false, message: "Ungültiger Kanal." };
    if (!DIRECTIONS.includes(input.direction))
      return { ok: false, message: "Ungültige Richtung." };

    const subject = input.subject.trim().slice(0, 300);
    const body = input.body.trim().slice(0, 10000);
    if (!subject && !body)
      return { ok: false, message: "Bitte Betreff oder Inhalt angeben." };

    const entityType =
      input.entityType === "candidate" || input.entityType === "company"
        ? input.entityType
        : null;
    const entityId = entityType && input.entityId ? input.entityId : null;

    const occurredAt = input.occurredAt ? parseBerlinLocal(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime()))
      return { ok: false, message: "Ungültiger Zeitpunkt." };

    const [row] = await sql`
      insert into admin.communication
        (channel, direction, subject, body, entity_type, entity_id, employee_id, occurred_at)
      values
        (${input.channel}, ${input.direction}, ${subject || null}, ${body || null},
         ${entityType}, ${entityId}, ${employee.id}, ${occurredAt})
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "communication.logged",
      entityType: entityType ?? "communication",
      entityId: entityId ?? (row.id as string),
      metadata: { channel: input.channel, direction: input.direction, subject },
    });

    revalidatePath("/kommunikation");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Eintrag konnte nicht gespeichert werden." };
  }
}
