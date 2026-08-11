"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PRIORITIES, type Priority } from "@/lib/definitions";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

export async function addJobNote(
  jobId: string,
  content: string,
  category: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, message: "Die Notiz darf nicht leer sein." };
    await sql`
      insert into admin.note (content, category, author_id, entity_type, entity_id)
      values (${trimmed}, ${category || "ALLGEMEIN"}, ${employee.id}, 'job', ${jobId})`;
    await recordAudit({
      actorId: employee.id,
      action: "job.note_added",
      entityType: "job",
      entityId: jobId,
      metadata: { category },
    });
    revalidatePath(`/stellen/${jobId}`);
    return { ok: true, message: "Notiz gespeichert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gespeichert werden." };
  }
}

export async function addJobTask(
  jobId: string,
  payload: {
    title: string;
    description?: string;
    dueAt?: string | null;
    priority?: string;
    assigneeId?: string | null;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");
    const title = payload.title.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const priority = PRIORITIES.includes(payload.priority as Priority)
      ? payload.priority
      : "NORMAL";
    await sql`
      insert into admin.task (title, description, assignee_id, creator_id, due_at, priority, status, entity_type, entity_id)
      values (${title}, ${payload.description?.trim() || null},
              ${payload.assigneeId ?? employee.id}, ${employee.id},
              ${payload.dueAt || null}, ${priority!}, 'OPEN', 'job', ${jobId})`;
    await recordAudit({
      actorId: employee.id,
      action: "job.task_created",
      entityType: "job",
      entityId: jobId,
      metadata: { title },
    });
    revalidatePath(`/stellen/${jobId}`);
    return { ok: true, message: "Aufgabe angelegt." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}
