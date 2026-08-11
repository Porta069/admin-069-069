"use server";

import { parseBerlinLocal } from "@/lib/format";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function createAppointment(input: {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  employeeId: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("calendar", "create");
    const title = input.title.trim().slice(0, 200);
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const startsAt = parseBerlinLocal(input.startsAt);
    const endsAt = parseBerlinLocal(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
      return { ok: false, message: "Bitte Datum und Uhrzeit angeben." };
    if (endsAt <= startsAt)
      return { ok: false, message: "Das Ende muss nach dem Beginn liegen." };

    const description = input.description.trim().slice(0, 2000) || null;
    const location = input.location.trim().slice(0, 200) || null;
    const employeeId = input.employeeId || employee.id;

    const [appointment] = await sql`
      insert into admin.appointment (title, description, starts_at, ends_at, location, employee_id, status)
      values (${title}, ${description}, ${startsAt}, ${endsAt}, ${location}, ${employeeId}, 'PLANNED')
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "appointment.created",
      entityType: "appointment",
      entityId: appointment.id as string,
      metadata: { title, startsAt: startsAt.toISOString(), employeeId },
    });

    revalidatePath("/kalender");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Termin konnte nicht erstellt werden." };
  }
}

export async function setAppointmentStatus(
  id: string,
  status: "PLANNED" | "DONE" | "CANCELLED",
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("calendar", "edit");
    if (!["PLANNED", "DONE", "CANCELLED"].includes(status))
      return { ok: false, message: "Ungültiger Status." };
    await sql`
      update admin.appointment set status = ${status}
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "appointment.status_changed",
      entityType: "appointment",
      entityId: id,
      metadata: { status },
    });
    revalidatePath("/kalender");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

export async function deleteAppointment(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("calendar", "delete");
    await sql`
      update admin.appointment set deleted_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "appointment.deleted",
      entityType: "appointment",
      entityId: id,
    });
    revalidatePath("/kalender");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Termin konnte nicht gelöscht werden." };
  }
}
