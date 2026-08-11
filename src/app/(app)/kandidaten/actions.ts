"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  CANDIDATE_STATUS,
  PRIORITIES,
  PRIORITY_LABELS,
  statusDef,
  type Priority,
} from "@/lib/definitions";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const PIPELINE_STATUSES = Object.keys(CANDIDATE_STATUS);
const CHANNELS = ["EMAIL", "TELEFON", "WHATSAPP", "SONSTIGE"];
const DIRECTIONS = ["INBOUND", "OUTBOUND"];

function revalidateCandidate(applicationId?: string) {
  revalidatePath("/kandidaten");
  if (applicationId) revalidatePath(`/kandidaten/${applicationId}`);
}

// ── Pipeline-Status ──────────────────────────────────────────────────────

export async function updateCandidateStatus(
  applicationId: string,
  status: string | null,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!status || !PIPELINE_STATUSES.includes(status)) {
      return { ok: false, message: "Unbekannter Pipeline-Status." };
    }
    await sql`
      insert into admin.candidate_meta (application_id, status, updated_at)
      values (${applicationId}, ${status}, now())
      on conflict (application_id)
      do update set status = ${status}, updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.status_changed",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { status },
    });
    revalidateCandidate(applicationId);
    return {
      ok: true,
      message: `Status auf „${statusDef(CANDIDATE_STATUS, status).label}" gesetzt.`,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

// ── Priorität ────────────────────────────────────────────────────────────

export async function updateCandidatePriority(
  applicationId: string,
  priority: string | null,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!priority || !PRIORITIES.includes(priority as Priority)) {
      return { ok: false, message: "Unbekannte Priorität." };
    }
    await sql`
      insert into admin.candidate_meta (application_id, priority, updated_at)
      values (${applicationId}, ${priority}, now())
      on conflict (application_id)
      do update set priority = ${priority}, updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.priority_changed",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { priority },
    });
    revalidateCandidate(applicationId);
    return {
      ok: true,
      message: `Priorität auf „${PRIORITY_LABELS[priority as Priority]}" gesetzt.`,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Priorität konnte nicht geändert werden." };
  }
}

// ── Zuweisung ────────────────────────────────────────────────────────────

export async function assignCandidate(
  applicationId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "assign");
    await sql`
      insert into admin.candidate_meta (application_id, assignee_id, updated_at)
      values (${applicationId}, ${assigneeId}, now())
      on conflict (application_id)
      do update set assignee_id = ${assigneeId}, updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.assigned",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { assigneeId },
    });
    revalidateCandidate(applicationId);
    return { ok: true, message: "Zuständigkeit aktualisiert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Zuweisung fehlgeschlagen." };
  }
}

// ── Notizen ──────────────────────────────────────────────────────────────

export async function addCandidateNote(
  applicationId: string,
  content: string,
  category: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, message: "Die Notiz darf nicht leer sein." };
    await sql`
      insert into admin.note (content, category, author_id, entity_type, entity_id)
      values (${trimmed}, ${category || "ALLGEMEIN"}, ${employee.id}, 'candidate', ${applicationId})`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.note_added",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { category },
    });
    revalidateCandidate(applicationId);
    return { ok: true, message: "Notiz gespeichert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gespeichert werden." };
  }
}

// ── Aufgaben ─────────────────────────────────────────────────────────────

export async function addCandidateTask(
  applicationId: string,
  payload: {
    title: string;
    description?: string;
    dueAt?: string | null;
    priority?: string;
    assigneeId?: string | null;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const title = payload.title.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const priority = PRIORITIES.includes(payload.priority as Priority)
      ? payload.priority
      : "NORMAL";
    await sql`
      insert into admin.task (title, description, assignee_id, creator_id, due_at, priority, status, entity_type, entity_id)
      values (${title}, ${payload.description?.trim() || null},
              ${payload.assigneeId ?? employee.id}, ${employee.id},
              ${payload.dueAt || null}, ${priority!}, 'OPEN', 'candidate', ${applicationId})`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.task_created",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { title },
    });
    revalidateCandidate(applicationId);
    return { ok: true, message: "Aufgabe angelegt." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}

// ── Kommunikation ────────────────────────────────────────────────────────

export async function logCandidateCommunication(
  applicationId: string,
  payload: {
    channel: string;
    direction: string;
    subject?: string;
    body?: string;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!CHANNELS.includes(payload.channel)) {
      return { ok: false, message: "Unbekannter Kanal." };
    }
    if (!DIRECTIONS.includes(payload.direction)) {
      return { ok: false, message: "Unbekannte Richtung." };
    }
    await sql`
      insert into admin.communication (channel, direction, subject, body, entity_type, entity_id, employee_id, occurred_at)
      values (${payload.channel}, ${payload.direction},
              ${payload.subject?.trim() || null}, ${payload.body?.trim() || null},
              'candidate', ${applicationId}, ${employee.id}, now())`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.communication_logged",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { channel: payload.channel, direction: payload.direction },
    });
    revalidateCandidate(applicationId);
    return { ok: true, message: "Kommunikation protokolliert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Eintrag konnte nicht gespeichert werden." };
  }
}

// ── Bulk-Aktionen ────────────────────────────────────────────────────────

export async function bulkSetStatusGeprueft(
  ids: string[],
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (ids.length === 0) return { ok: false, message: "Keine Auswahl." };
    await sql`
      insert into admin.candidate_meta (application_id, status, updated_at)
      select t.id, 'GEPRUEFT', now() from unnest(${ids}::text[]) as t(id)
      on conflict (application_id)
      do update set status = 'GEPRUEFT', updated_at = now()`;
    await Promise.all(
      ids.map((id) =>
        recordAudit({
          actorId: employee.id,
          action: "candidate.status_changed",
          entityType: "candidate",
          entityId: id,
          metadata: { status: "GEPRUEFT", bulk: true },
        }),
      ),
    );
    revalidateCandidate();
    return { ok: true, message: `${ids.length} Kandidaten auf „Geprüft" gesetzt.` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bulk-Aktion fehlgeschlagen." };
  }
}

export async function bulkAssignToMe(ids: string[]): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "assign");
    if (ids.length === 0) return { ok: false, message: "Keine Auswahl." };
    await sql`
      insert into admin.candidate_meta (application_id, assignee_id, updated_at)
      select t.id, ${employee.id}::uuid, now() from unnest(${ids}::text[]) as t(id)
      on conflict (application_id)
      do update set assignee_id = ${employee.id}, updated_at = now()`;
    await Promise.all(
      ids.map((id) =>
        recordAudit({
          actorId: employee.id,
          action: "candidate.assigned",
          entityType: "candidate",
          entityId: id,
          metadata: { assigneeId: employee.id, bulk: true },
        }),
      ),
    );
    revalidateCandidate();
    return { ok: true, message: `${ids.length} Kandidaten dir zugewiesen.` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bulk-Aktion fehlgeschlagen." };
  }
}

export async function bulkSetPriorityHoch(ids: string[]): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (ids.length === 0) return { ok: false, message: "Keine Auswahl." };
    await sql`
      insert into admin.candidate_meta (application_id, priority, updated_at)
      select t.id, 'HOCH', now() from unnest(${ids}::text[]) as t(id)
      on conflict (application_id)
      do update set priority = 'HOCH', updated_at = now()`;
    await Promise.all(
      ids.map((id) =>
        recordAudit({
          actorId: employee.id,
          action: "candidate.priority_changed",
          entityType: "candidate",
          entityId: id,
          metadata: { priority: "HOCH", bulk: true },
        }),
      ),
    );
    revalidateCandidate();
    return { ok: true, message: `Priorität für ${ids.length} Kandidaten auf „Hoch" gesetzt.` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bulk-Aktion fehlgeschlagen." };
  }
}
