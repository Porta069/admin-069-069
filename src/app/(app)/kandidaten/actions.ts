"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { processOutbox } from "@/lib/mailer";
import {
  renderVorlageEmail,
  substituteVars,
  type VorlageDaten,
} from "@/lib/email-templates";
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
  // Matching-Cache (getMatchingCandidates) gezielt auffrischen, damit
  // Status-/Profiländerungen sofort ins Scoring einfließen statt erst nach TTL.
  revalidateTag("candidates", "max");
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

// ── Vorgefertigte E-Mails an die Person ──────────────────────────────────

export interface VersandVorlage extends VorlageDaten {
  event: string;
  name: string;
  kategorie: string;
  variablen: { key: string; label: string; beispiel: string }[];
}

/** Alle Benachrichtigungs-Vorlagen für den manuellen Versand an eine Person. */
export async function vorlagenFuerVersand(): Promise<
  { ok: true; vorlagen: VersandVorlage[] } | { ok: false; message: string }
> {
  try {
    await requirePermission("candidates", "edit");
    const rows = await sql`
      select event, name, kategorie, variante, titel, betreff, einleitung, schluss,
             hervorhebung, variablen
      from admin.benachrichtigung_vorlage
      order by kategorie, name`;
    const vorlagen = rows.map((r) => ({
      event: r.event as string,
      name: r.name as string,
      kategorie: r.kategorie as string,
      variante: (r.variante as string) ?? "brief",
      titel: (r.titel as string) ?? "",
      betreff: (r.betreff as string) ?? "",
      einleitung: (r.einleitung as string) ?? "",
      schluss: (r.schluss as string) ?? "",
      hervorhebung: (r.hervorhebung as string) ?? "",
      variablen: Array.isArray(r.variablen)
        ? (r.variablen as VersandVorlage["variablen"])
        : [],
    }));
    return { ok: true, vorlagen };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Vorlagen konnten nicht geladen werden." };
  }
}

const VERIFY_EVENTS = new Set([
  "bestaetigungscode",
  "email_verifizierung",
  "passwort_reset",
]);

/** Rendert eine Vorlage mit den Personendaten und reiht sie in die Outbox ein. */
export async function sendeVorlageAnKandidat(
  applicationId: string,
  event: string,
  vars: Record<string, string>,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const [c] = await sql`
      select id, "firstName", "lastName", email from admin.candidate
      where id = ${applicationId} and status <> 'ERASED' limit 1`;
    if (!c) return { ok: false, message: "Kandidat wurde nicht gefunden." };
    if (!c.email)
      return { ok: false, message: "Für diese Person ist keine E-Mail-Adresse hinterlegt." };

    const [v] = await sql`
      select variante, titel, betreff, einleitung, schluss, hervorhebung, code
      from admin.benachrichtigung_vorlage where event = ${event} limit 1`;
    if (!v) return { ok: false, message: "Vorlage wurde nicht gefunden." };

    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Kandidat";
    const heute = new Intl.DateTimeFormat("de-DE").format(new Date());
    const merged: Record<string, string> = {
      name,
      email: c.email as string,
      datum: heute,
    };
    for (const [k, val] of Object.entries(vars || {})) merged[k] = String(val ?? "");

    const { subject, text, html } = renderVorlageEmail(v as VorlageDaten, merged);
    const kind = VERIFY_EVENTS.has(event) ? "VERIFICATION" : "SYSTEM";

    const [mail] = await sql`
      insert into admin.outbox_email
        (to_email, to_name, subject, body, html, kind, entity_type, entity_id,
         event_code, created_by)
      values (${c.email as string}, ${name}, ${subject}, ${text}, ${html},
              ${kind}, 'candidate', ${applicationId},
              ${(v.code as number | null) ?? null}, ${employee.id})
      returning id`;

    // Sofort versenden (statt auf den nächsten Sync-Lauf zu warten).
    let versendet = false;
    let fehler: string | null = null;
    try {
      await processOutbox();
      const [nachher] = await sql`
        select status, error from admin.outbox_email where id = ${mail.id}`;
      versendet = nachher?.status === "SENT";
      if (nachher?.status === "FAILED") fehler = (nachher.error as string) ?? "unbekannt";
    } catch (e) {
      console.error("processOutbox nach Vorlagen-Mail fehlgeschlagen", e);
    }

    if (fehler) {
      return { ok: false, message: `Versand fehlgeschlagen: ${fehler}` };
    }

    // Hinweis: Das Protokollieren im Kommunikations-Verlauf passiert jetzt
    // ZENTRAL beim Versand (processOutbox) — Standard-Vorlage als Nummer,
    // individuelle Mail als Betreff. Gilt damit für JEDEN E-Mail-Verkehr.

    await recordAudit({
      actorId: employee.id,
      action: "candidate.template_email_sent",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { event, to: c.email, versendet },
    });

    revalidateCandidate(applicationId);
    return {
      ok: true,
      message: versendet
        ? `E-Mail „${subject}" wurde an ${c.email} versendet.`
        : `E-Mail „${subject}" wurde eingereiht und wird in Kürze versendet.`,
    };
  } catch (e) {
    console.error("sendeVorlageAnKandidat failed", e);
    return { ok: false, message: "Die E-Mail konnte nicht versendet werden." };
  }
}

/** Einzelnen Kommunikations-Eintrag im Profil löschen (Soft-Delete). */
export async function deleteCommunication(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const [row] = await sql`
      update admin.communication set deleted_at = now()
      where id = ${id} and entity_type = 'candidate' and deleted_at is null
      returning entity_id`;
    if (!row) return { ok: false, message: "Eintrag wurde nicht gefunden." };
    await recordAudit({
      actorId: employee.id,
      action: "candidate.communication_deleted",
      entityType: "candidate",
      entityId: row.entity_id as string,
      metadata: { communicationId: id },
    });
    revalidateCandidate(row.entity_id as string);
    return { ok: true, message: "Eintrag gelöscht." };
  } catch (e) {
    console.error("deleteCommunication failed", e);
    return { ok: false, message: "Eintrag konnte nicht gelöscht werden." };
  }
}

/** Komplett individuelle E-Mail an den Kandidaten (freier Betreff + Text). */
export async function sendeIndividuelleEmail(
  applicationId: string,
  betreff: string,
  nachricht: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const b = betreff.trim();
    const n = nachricht.trim();
    if (!b) return { ok: false, message: "Bitte einen Betreff angeben." };
    if (!n) return { ok: false, message: "Bitte einen Text angeben." };

    const [c] = await sql`
      select id, "firstName", "lastName", email from admin.candidate
      where id = ${applicationId} and status <> 'ERASED' limit 1`;
    if (!c) return { ok: false, message: "Kandidat wurde nicht gefunden." };
    if (!c.email)
      return { ok: false, message: "Für diese Person ist keine E-Mail-Adresse hinterlegt." };

    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Kandidat";
    const heute = new Intl.DateTimeFormat("de-DE").format(new Date());
    const vars = { name, email: c.email as string, datum: heute };

    const { text, html } = renderVorlageEmail(
      {
        variante: "brief",
        titel: "",
        betreff: b,
        einleitung: n,
        schluss: "",
        hervorhebung: "",
      },
      vars,
    );
    const subject = substituteVars(b, vars);

    // Individuelle Mail → kein event_code (wird im Verlauf nur als Betreff geführt).
    const [mail] = await sql`
      insert into admin.outbox_email
        (to_email, to_name, subject, body, html, kind, entity_type, entity_id, created_by)
      values (${c.email as string}, ${name}, ${subject}, ${text}, ${html},
              'SYSTEM', 'candidate', ${applicationId}, ${employee.id})
      returning id`;

    let versendet = false;
    let fehler: string | null = null;
    try {
      await processOutbox();
      const [nachher] = await sql`
        select status, error from admin.outbox_email where id = ${mail.id}`;
      versendet = nachher?.status === "SENT";
      if (nachher?.status === "FAILED") fehler = (nachher.error as string) ?? "unbekannt";
    } catch (e) {
      console.error("processOutbox (individuell) fehlgeschlagen", e);
    }

    if (fehler) return { ok: false, message: `Versand fehlgeschlagen: ${fehler}` };

    await recordAudit({
      actorId: employee.id,
      action: "candidate.custom_email_sent",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { subject, to: c.email, versendet },
    });
    revalidateCandidate(applicationId);
    return {
      ok: true,
      message: versendet
        ? `E-Mail „${subject}" wurde an ${c.email} versendet.`
        : `E-Mail „${subject}" wurde eingereiht und wird in Kürze versendet.`,
    };
  } catch (e) {
    console.error("sendeIndividuelleEmail failed", e);
    return { ok: false, message: "Die E-Mail konnte nicht versendet werden." };
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

// ── Termin-Bewertung (Freundlichkeit + bester Job-Match) ──────────────────

export async function saveReview(
  applicationId: string,
  candidateName: string,
  payload: {
    freundlichkeit: number;
    jobId: string | null;
    jobTitle: string | null;
    notiz: string;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    const f = Math.round(Number(payload.freundlichkeit));
    if (!(f >= 1 && f <= 5)) {
      return { ok: false, message: "Bitte eine Freundlichkeit von 1 bis 5 wählen." };
    }
    const topJob =
      payload.jobId && payload.jobTitle
        ? { jobId: payload.jobId, title: payload.jobTitle }
        : null;
    await sql`
      insert into admin.review
        (application_id, candidate_name, employee_id, freundlichkeit, top_job, notiz)
      values (${applicationId}, ${candidateName}, ${employee.id}, ${f},
              ${topJob ? sql.json(topJob) : null}, ${payload.notiz?.trim() || null})`;
    await recordAudit({
      actorId: employee.id,
      action: "candidate.review_added",
      entityType: "candidate",
      entityId: applicationId,
      metadata: { freundlichkeit: f, bestesJob: payload.jobTitle ?? null },
    });
    revalidateCandidate(applicationId);
    return { ok: true, message: "Bewertung gespeichert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bewertung konnte nicht gespeichert werden." };
  }
}
