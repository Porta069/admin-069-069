"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  reRankMitAntworten,
  kiZusatzfragen,
  kiBewerberZusammenfassung,
  kiJobArgumente,
  kiGespraechsergebnis,
  type AnrufJob,
  type AnrufKriterium,
  type KiDiff,
  type KiZusatzErgebnis,
  type KiZusammenfassung,
  type KiPitch,
  type KiGespraechsergebnis,
} from "@/lib/matching/anruf";

export type Ergebnis =
  | { ok: true; scores: AnrufJob[] }
  | { ok: false; fehler: string };

/**
 * KI-Zusatzfragen bei Gleichstand — bekommt NUR die Unterschiede der Betriebe
 * (Token-sparsam) und meldet zurück, ob weitere Fragen nötig sind.
 */
export async function generiereZusatzfragen(
  diffs: KiDiff[],
): Promise<{ ok: true; ergebnis: KiZusatzErgebnis } | { ok: false; fehler: string }> {
  try {
    await requirePermission("candidates", "edit");
    const ergebnis = await kiZusatzfragen(diffs);
    return { ok: true, ergebnis };
  } catch (e) {
    console.error("generiereZusatzfragen failed", e);
    return { ok: false, fehler: "KI-Rückmeldung fehlgeschlagen — bitte erneut versuchen." };
  }
}

/**
 * (a) KI-Bewerber-Zusammenfassung + Kernstärken (on-demand, günstig, gecacht).
 */
export async function kiZusammenfassungFuer(
  email: string,
  jobTitles: string[],
): Promise<{ ok: true; ergebnis: KiZusammenfassung } | { ok: false; fehler: string }> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const ergebnis = await kiBewerberZusammenfassung(email, jobTitles, employee.id);
    return { ok: true, ergebnis };
  } catch (e) {
    console.error("kiZusammenfassungFuer failed", e);
    return { ok: false, fehler: "KI-Zusammenfassung fehlgeschlagen — bitte erneut versuchen." };
  }
}

/**
 * (b) KI-Gesprächsargumente/Pitch für den aktuellen Top-Match (on-demand).
 */
export async function kiPitchFuer(input: {
  email: string;
  jobTitle: string;
  companyName: string | null;
  kriterien: AnrufKriterium[];
}): Promise<{ ok: true; ergebnis: KiPitch } | { ok: false; fehler: string }> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const ergebnis = await kiJobArgumente(input, employee.id);
    return { ok: true, ergebnis };
  } catch (e) {
    console.error("kiPitchFuer failed", e);
    return { ok: false, fehler: "KI-Argumente fehlgeschlagen — bitte erneut versuchen." };
  }
}

/**
 * (c) KI-Gesprächsergebnis, nächste Schritte & Dokumentationsvorschlag.
 */
export async function kiErgebnisFuer(input: {
  notiz: string;
  antworten: { label: string; wert: string }[];
  topMatch: { title: string; companyName: string | null; score: number } | null;
}): Promise<{ ok: true; ergebnis: KiGespraechsergebnis } | { ok: false; fehler: string }> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const ergebnis = await kiGespraechsergebnis(input, employee.id);
    return { ok: true, ergebnis };
  } catch (e) {
    console.error("kiErgebnisFuer failed", e);
    return { ok: false, fehler: "KI-Gesprächsergebnis fehlgeschlagen — bitte erneut versuchen." };
  }
}

/**
 * Mitarbeiterzuordnung: setzt den Bearbeiter der Anruf-Aufgabe und schreibt
 * einen Audit-Eintrag (nachvollziehbar, wer den Anruf übernommen hat).
 */
export async function bearbeiterZuweisen(
  taskId: string | null,
  applicationId: string,
  employeeId: string,
): Promise<{ ok: true; employeeName: string } | { ok: false; fehler: string }> {
  try {
    const employee = await requirePermission("candidates", "edit");

    const [ziel] = await sql`
      select name from admin.employee
      where id = ${employeeId} and deleted_at is null and status = 'ACTIVE' limit 1`;
    if (!ziel) {
      return { ok: false, fehler: "Mitarbeiter nicht gefunden oder inaktiv." };
    }
    const employeeName = ziel.name as string;

    if (taskId) {
      await sql`
        update admin.task set assignee_id = ${employeeId}, updated_at = now()
        where id = ${taskId} and deleted_at is null`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "call.claimed",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { taskId, employeeId, employeeName },
    });

    revalidatePath(`/kandidaten/${applicationId}`);
    revalidatePath("/aufgaben");
    return { ok: true, employeeName };
  } catch (e) {
    console.error("bearbeiterZuweisen failed", e);
    return { ok: false, fehler: "Bearbeiter konnte nicht gesetzt werden — bitte erneut versuchen." };
  }
}

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
