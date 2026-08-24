"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { erstelleAffiliateBonusAufgabe } from "@/lib/rewards";
import { autoKandidatStatus } from "@/lib/candidate-status";
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

export type ErgebnisTyp = "RUECKRUF" | "SACKGASSE" | "TERMIN" | "VERMITTLUNG";

/**
 * Gesprächsergebnis nach einem Anruf: schließt Anruf + Aufgabe ab und löst je
 * nach Ausgang die passende Folgeaktion aus — Rückruf (neu in die
 * Warteschlange), Sackgasse (raus aus der aktiven Kartei), Termin (mit Grund im
 * Kalender) oder Vermittlung (Placement → Vermittlungen).
 */
export async function anrufErgebnis(input: {
  applicationId: string;
  candidateName: string;
  email: string;
  taskId: string | null;
  fragen: unknown;
  antworten: Record<string, string>;
  topJobs: { jobId: string; title: string; companyName: string | null }[];
  notiz: string;
  ergebnis: ErgebnisTyp;
  rueckrufAt?: string | null;
  terminAt?: string | null;
  grund?: string | null;
  jobId?: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; fehler: string }> {
  try {
    const employee = await requirePermission("candidates", "edit");

    const scores = await reRankMitAntworten(
      input.email,
      input.topJobs.map((j) => j.jobId),
      input.antworten,
    );

    // Absagegrund (Sackgasse) an die Notiz anhängen, damit er nicht verloren geht.
    const notizFinal =
      input.ergebnis === "SACKGASSE" && input.grund?.trim()
        ? [input.notiz?.trim(), `Absagegrund: ${input.grund.trim()}`]
            .filter(Boolean)
            .join("\n")
        : input.notiz;

    // Anruf-Session abschließen (mit Ergebnis).
    const [existing] = await sql`
      select id from admin.call_session
      where application_id = ${input.applicationId} and deleted_at is null
        and status = 'OFFEN' order by created_at desc limit 1`;
    if (existing) {
      await sql`
        update admin.call_session set
          antworten = ${sql.json(input.antworten as never)},
          top_jobs = ${sql.json(scores as never)}, notiz = ${notizFinal || null},
          ergebnis = ${input.ergebnis}, status = 'ABGESCHLOSSEN', completed_at = now()
        where id = ${existing.id}`;
    } else {
      await sql`
        insert into admin.call_session
          (application_id, candidate_name, employee_id, task_id, fragen,
           antworten, top_jobs, ergebnis, status, notiz, completed_at)
        values (${input.applicationId}, ${input.candidateName}, ${employee.id},
                ${input.taskId}, ${sql.json(input.fragen as never)},
                ${sql.json(input.antworten as never)}, ${sql.json(scores as never)},
                ${input.ergebnis}, 'ABGESCHLOSSEN', ${notizFinal || null}, now())`;
    }

    if (input.taskId) {
      await sql`
        update admin.task set status = 'DONE', completed_at = now(), updated_at = now()
        where id = ${input.taskId} and deleted_at is null`;
    }

    // Nach dem Telefonat automatisch auf „Angerufen" (nur aus Neu-Registrierung —
    // spätere Ergebnis-Zweige setzen ggf. einen konkreteren Status).
    await autoKandidatStatus(input.applicationId, "ANGERUFEN", ["NEU"]);

    let message = "Anruf abgeschlossen.";

    if (input.ergebnis === "RUECKRUF") {
      const when = input.rueckrufAt
        ? new Date(input.rueckrufAt)
        : new Date(Date.now() + 24 * 3600 * 1000);
      await sql`
        insert into admin.task
          (title, description, assignee_id, due_at, priority, status, entity_type, entity_id)
        values (${`Rückruf: ${input.candidateName}`},
                ${input.notiz ? `Aus dem Anruf: ${input.notiz}` : null},
                ${employee.id}, ${when}, 'HOCH', 'OPEN', 'candidate', ${input.applicationId})`;
      message = "Rückruf geplant — der Kandidat ist wieder in der Warteschlange.";
    } else if (input.ergebnis === "SACKGASSE") {
      await sql`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${input.applicationId}, 'KEIN_INTERESSE', now())
        on conflict (application_id) do update set status = 'KEIN_INTERESSE', updated_at = now()`;
      message = "Als „Kein Interesse“ markiert — Kandidat aus der aktiven Kartei entfernt.";
    } else if (input.ergebnis === "TERMIN") {
      const when = input.terminAt ? new Date(input.terminAt) : null;
      if (!when || Number.isNaN(when.getTime())) {
        return { ok: false, fehler: "Bitte einen Termin-Zeitpunkt wählen." };
      }
      const ende = new Date(when.getTime() + 60 * 60 * 1000);
      await sql`
        insert into admin.appointment
          (title, description, starts_at, ends_at, employee_id, entity_type, entity_id, status)
        values (${`Termin: ${input.candidateName}`}, ${input.grund?.trim() || null},
                ${when}, ${ende}, ${employee.id}, 'candidate', ${input.applicationId}, 'PLANNED')`;
      await sql`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${input.applicationId}, 'BEWERBUNG', now())
        on conflict (application_id) do update set status = 'BEWERBUNG', updated_at = now()`;
      message = "Termin angelegt und im Kalender hinterlegt.";
    } else if (input.ergebnis === "VERMITTLUNG") {
      if (!input.jobId) return { ok: false, fehler: "Bitte die vermittelte Stelle wählen." };
      const [job] = await sql`
        select j.id, j.title, j."companyId" as company_id, c.name as company_name
        from public."JobPosting" j
        left join public."Company" c on c.id = j."companyId"
        where j.id = ${input.jobId} limit 1`;
      if (!job) return { ok: false, fehler: "Stelle nicht gefunden." };
      const [pr] = await sql`select value from admin.setting where key = 'pricing'`;
      const pricing = (pr?.value ?? {}) as Record<string, unknown>;
      const baseFee =
        typeof pricing.base_fee_cents === "number" ? pricing.base_fee_cents : 4900;
      const score = scores.find((s) => s.jobId === input.jobId)?.score ?? null;
      const [placement] = await sql`
        insert into admin.placement
          (application_id, candidate_name, company_id, company_name, job_posting_id,
           job_title, employee_id, status, placed_at, base_fee_cents, commission_cents,
           notes, match_score, retention_due_at)
        values (${input.applicationId}, ${input.candidateName}, ${job.company_id},
                ${job.company_name}, ${job.id}, ${job.title}, ${employee.id}, 'PLACED',
                now(), ${baseFee}, 0, ${input.notiz?.trim() || null},
                ${score != null ? Math.round(score) : null}, now() + interval '56 days')
        returning id`;
      await sql`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${input.applicationId}, 'ANGENOMMEN', now())
        on conflict (application_id) do update set status = 'ANGENOMMEN', updated_at = now()`;
      // €20-Affiliate-Bonus als finanzen-Aufgabe, falls über Affiliate-Link geworben.
      await erstelleAffiliateBonusAufgabe(placement.id as string);
      message = "Vermittlung eingetragen — erscheint jetzt unter Vermittlungen.";
    }

    await recordAudit({
      actorId: employee.id,
      action: "candidate.call_outcome",
      entityType: "candidate",
      entityId: input.applicationId,
      metadata: { ergebnis: input.ergebnis },
    });

    revalidatePath(`/kandidaten/${input.applicationId}`);
    revalidatePath("/kandidaten");
    revalidatePath("/aufgaben");
    revalidatePath("/callcenter");
    revalidatePath("/kalender");
    revalidatePath("/vermittlungen");
    return { ok: true, message };
  } catch (e) {
    console.error("anrufErgebnis failed", e);
    return { ok: false, fehler: "Speichern fehlgeschlagen — bitte erneut versuchen." };
  }
}

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

    // Abgeschlossenes Telefonat → automatisch „Angerufen" (nur aus Neu-Registrierung).
    if (abschliessen) {
      await autoKandidatStatus(applicationId, "ANGERUFEN", ["NEU"]);
    }

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
