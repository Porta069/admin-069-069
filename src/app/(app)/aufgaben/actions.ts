"use server";

import { parseBerlinLocal } from "@/lib/format";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; message: string };

const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"];
const TASK_PRIORITIES = ["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"];

export async function createTask(input: {
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;
  priority: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("tasks", "create");
    const title = input.title.trim().slice(0, 200);
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const priority = TASK_PRIORITIES.includes(input.priority)
      ? input.priority
      : "NORMAL";
    const description = input.description.trim().slice(0, 2000) || null;
    const assigneeId = input.assigneeId || null;
    const dueAt = input.dueAt ? parseBerlinLocal(input.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime()))
      return { ok: false, message: "Ungültige Fälligkeit." };

    const [task] = await sql`
      insert into admin.task (title, description, assignee_id, creator_id, due_at, priority, status)
      values (${title}, ${description}, ${assigneeId}, ${employee.id}, ${dueAt}, ${priority}, 'OPEN')
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "task.created",
      entityType: "task",
      entityId: task.id as string,
      metadata: { title, assigneeId, priority },
    });

    if (assigneeId && assigneeId !== employee.id) {
      await sql`
        insert into admin.notification (employee_id, type, title, body, priority)
        values (${assigneeId}, 'TASK_ASSIGNED', ${"Neue Aufgabe: " + title}, ${description}, ${priority})`;
    }

    revalidatePath("/aufgaben");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht erstellt werden." };
  }
}

export async function completeTask(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("tasks", "edit");
    await sql`
      update admin.task
      set status = 'DONE', completed_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "task.completed",
      entityType: "task",
      entityId: id,
    });
    revalidatePath("/aufgaben");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht erledigt werden." };
  }
}

export async function setTaskStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("tasks", "edit");
    if (!TASK_STATUSES.includes(status))
      return { ok: false, message: "Ungültiger Status." };
    await sql`
      update admin.task
      set status = ${status},
          completed_at = ${status === "DONE" ? sql`now()` : sql`null`},
          updated_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "task.status_changed",
      entityType: "task",
      entityId: id,
      metadata: { status },
    });
    revalidatePath("/aufgaben");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

export async function setTaskPriority(
  id: string,
  priority: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("tasks", "edit");
    if (!TASK_PRIORITIES.includes(priority))
      return { ok: false, message: "Ungültige Priorität." };
    await sql`
      update admin.task set priority = ${priority}, updated_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "task.priority_changed",
      entityType: "task",
      entityId: id,
      metadata: { priority },
    });
    revalidatePath("/aufgaben");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Priorität konnte nicht geändert werden." };
  }
}

/**
 * Termine zählen als Aufgaben: Der Erledigt-Button in den Aufgabenlisten
 * setzt einen Termin auf DONE (Berechtigung: Kalender bearbeiten).
 */
export async function completeAppointment(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("calendar", "edit");
    await sql`
      update admin.appointment set status = 'DONE'
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "appointment.completed",
      entityType: "appointment",
      entityId: id,
    });
    revalidatePath("/aufgaben");
    revalidatePath("/kalender");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Termin konnte nicht erledigt werden." };
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("tasks", "delete");
    await sql`
      update admin.task set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "task.deleted",
      entityType: "task",
      entityId: id,
    });
    revalidatePath("/aufgaben");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht gelöscht werden." };
  }
}
