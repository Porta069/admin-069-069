"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { reRankMitAntworten } from "@/lib/matching/anruf";

export type Ergebnis =
  | { ok: true; scores: { jobId: string; title: string; companyName: string | null; score: number }[] }
  | { ok: false; fehler: string };

/**
 * Antworten aus dem Telefonat speichern und die Jobs deterministisch neu
 * ranken (ohne KI). Legt/aktualisiert eine admin.call_session.
 */
export async function anrufSpeichern(
  applicationId: string,
  candidateName: string,
  email: string,
  fragen: unknown,
  antworten: Record<string, string>,
  topJobs: { jobId: string; title: string; companyName: string | null }[],
  taskId: string | null,
  notiz: string,
  abschliessen: boolean,
): Promise<Ergebnis> {
  try {
    const employee = await requirePermission("candidates", "edit");

    const scores = await reRankMitAntworten(
      email,
      topJobs.map((j) => j.jobId),
      antworten,
    );

    const [existing] = await sql`
      select id from admin.call_session
      where application_id = ${applicationId} and deleted_at is null
        and status = 'OFFEN'
      order by created_at desc limit 1`;

    const payload = {
      fragen: sql.json(fragen as never),
      antworten: sql.json(antworten as never),
      overrides: sql.json(antworten as never),
      top_jobs: sql.json(scores as never),
    };

    if (existing) {
      await sql`
        update admin.call_session set
          antworten = ${payload.antworten}, overrides = ${payload.overrides},
          top_jobs = ${payload.top_jobs}, notiz = ${notiz || null},
          status = ${abschliessen ? "ABGESCHLOSSEN" : "OFFEN"},
          completed_at = ${abschliessen ? new Date() : null}
        where id = ${existing.id}`;
    } else {
      await sql`
        insert into admin.call_session
          (application_id, candidate_name, employee_id, task_id, fragen,
           antworten, overrides, top_jobs, status, notiz, completed_at)
        values (${applicationId}, ${candidateName}, ${employee.id}, ${taskId},
                ${payload.fragen}, ${payload.antworten}, ${payload.overrides},
                ${payload.top_jobs}, ${abschliessen ? "ABGESCHLOSSEN" : "OFFEN"},
                ${notiz || null}, ${abschliessen ? new Date() : null})`;
    }

    // Antworten fließen als bestätigte Verfügbarkeit/Status in die Timeline.
    await recordAudit({
      actorId: employee.id,
      action: abschliessen ? "candidate.call_completed" : "candidate.call_updated",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { antworten, bestesJob: scores[0]?.title ?? null },
    });

    // Aufgabe optional als erledigt markieren.
    if (abschliessen && taskId) {
      await sql`
        update admin.task set status = 'DONE', completed_at = now(), updated_at = now()
        where id = ${taskId} and deleted_at is null`;
    }

    revalidatePath(`/kandidaten/${applicationId}`);
    revalidatePath("/aufgaben");
    return { ok: true, scores };
  } catch (e) {
    console.error("anrufSpeichern failed", e);
    return { ok: false, fehler: "Speichern fehlgeschlagen — bitte erneut versuchen." };
  }
}
