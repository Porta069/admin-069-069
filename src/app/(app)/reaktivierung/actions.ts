"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Verfügbarkeit eines Kandidaten bestätigt → Zeitstempel in candidate_meta. */
export async function confirmAvailability(
  applicationId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!applicationId) return { ok: false, message: "Kein Kandidat angegeben." };

    await sql`
      insert into admin.candidate_meta (application_id, verfuegbar_bestaetigt_am, updated_at)
      values (${applicationId}, now(), now())
      on conflict (application_id)
      do update set verfuegbar_bestaetigt_am = now(), updated_at = now()`;

    await recordAudit({
      actorId: employee.id,
      action: "candidate.availability_confirmed",
      entityType: "candidate",
      entityId: applicationId,
      metadata: {},
    });

    revalidatePath("/reaktivierung");
    revalidatePath(`/kandidaten/${applicationId}`);
    return { ok: true, message: "Verfügbarkeit bestätigt." };
  } catch (e) {
    console.error("confirmAvailability failed", e);
    return { ok: false, message: "Bestätigung fehlgeschlagen. Bitte erneut versuchen." };
  }
}

/** Legt eine Reaktivierungs-Aufgabe für den Kandidaten an. */
export async function createReactivationTask(
  applicationId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!applicationId) return { ok: false, message: "Kein Kandidat angegeben." };

    const [candidate] = await sql`
      select "firstName" || ' ' || "lastName" as name
      from public."Application"
      where id = ${applicationId} and status <> 'ERASED'
      limit 1`;
    if (!candidate) return { ok: false, message: "Kandidat nicht gefunden." };

    const name = candidate.name as string;
    await sql`
      insert into admin.task
        (title, description, assignee_id, creator_id, due_at, priority, status,
         entity_type, entity_id)
      values
        (${`Reaktivierung: ${name}`},
         ${"Verfügbarkeit prüfen und Kandidat für passende Stellen reaktivieren."},
         ${employee.id}, ${employee.id}, now() + interval '3 days', 'HOCH', 'OPEN',
         'candidate', ${applicationId})`;

    await recordAudit({
      actorId: employee.id,
      action: "candidate.reactivation_task_created",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { title: `Reaktivierung: ${name}` },
    });

    revalidatePath("/reaktivierung");
    revalidatePath(`/kandidaten/${applicationId}`);
    revalidatePath("/aufgaben");
    return { ok: true, message: "Reaktivierungs-Aufgabe angelegt." };
  } catch (e) {
    console.error("createReactivationTask failed", e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}
