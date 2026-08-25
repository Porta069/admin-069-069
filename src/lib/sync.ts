import "server-only";
import { sql } from "./db";
import { processOutbox, queueEmail, renderTemplate } from "./mailer";
import { renderBrandedText } from "./email-templates";
import { erstelleFaelligeTreuepraemienAufgaben } from "./rewards";
import { erstelleSlaNachfassAufgaben } from "./sla";
import { warneInaktiveKandidaten } from "./event-mailer";
import { raeumeWahrgenommeneMitteilungen } from "./notify";
import { pushAnMitarbeiter } from "./ntfy";
import { autoKandidatStatus } from "./candidate-status";
import { backfillPayouts, autoProcessPayouts } from "./payouts";

/**
 * Event-Sync & Automation-Runner.
 *
 * Erkennt neue Plattform-Ereignisse (Registrierungen, Bewerbungen, Jobs,
 * Referral-Änderungen) seit dem letzten Lauf, erzeugt Benachrichtigungen,
 * führt aktivierte Automationen aus und verarbeitet die E-Mail-Outbox.
 *
 * Aufrufwege: Vercel Cron (täglich) + throttled nach jedem Seitenaufruf
 * (max. alle 5 Minuten) via after() im App-Layout.
 */

const THROTTLE_MINUTES = 5;

interface Employee {
  id: string;
  role_id: string;
}

async function notifiableEmployees(): Promise<Employee[]> {
  return (await sql`
    select id, role_id from admin.employee
    where status = 'ACTIVE' and deleted_at is null
      and role_id in ('SUPERADMIN', 'ADMIN', 'TEAMLEAD')`) as unknown as Employee[];
}

async function notify(
  employeeIds: string[],
  type: string,
  title: string,
  body: string | null,
  entityType?: string,
  entityId?: string,
) {
  for (const id of employeeIds) {
    await sql`
      insert into admin.notification
        (employee_id, type, title, body, entity_type, entity_id)
      values (${id}, ${type}, ${title}, ${body},
              ${entityType ?? null}, ${entityId ?? null})`;
  }
  // Handy-Push für dieselben Empfänger (Topic + Präferenz je Empfänger).
  await pushAnMitarbeiter(employeeIds, { type, title, body, entityType, entityId });
}

/**
 * Automatische Anruf-Aufgabe zu einer neuen Bewerbung (einmalig pro
 * Bewerbung). Zugewiesen an den Betreuer des Unternehmens, sonst ans Team.
 */
async function createCallTaskForApplication(b: {
  id: unknown;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  assignee_id?: string | null;
}): Promise<void> {
  const name =
    [b.firstName, b.lastName].filter(Boolean).join(" ") ||
    b.email ||
    "Bewerber";
  const kontakt = [b.phone, b.email].filter(Boolean).join(" · ") || "keine Kontaktdaten hinterlegt";
  await sql`
    insert into admin.task
      (title, description, assignee_id, due_at, priority, status, entity_type, entity_id)
    select
      ${`Bewerber anrufen: ${name}`},
      ${`Neue Bewerbung auf „${b.title ?? "Stelle"}"${b.company ? ` bei ${b.company}` : ""}. Bitte ${name} telefonisch kontaktieren: ${kontakt}`},
      ${b.assignee_id ?? null},
      now() + interval '1 day',
      'HOCH', 'OPEN', 'application', ${String(b.id)}
    where not exists (
      select 1 from admin.task t
      where t.entity_type = 'application' and t.entity_id = ${String(b.id)}
        and t.title like 'Bewerber anrufen:%' and t.deleted_at is null)`;
}

/** Läuft höchstens alle THROTTLE_MINUTES; gibt zurück ob gelaufen. */
export async function runSyncThrottled(): Promise<boolean> {
  const claimed = await sql`
    insert into admin.sync_state (key, last_run)
    values ('event_sync', now())
    on conflict (key) do update set last_run = now()
    where admin.sync_state.last_run is null
       or admin.sync_state.last_run < now() - interval '${sql.unsafe(String(THROTTLE_MINUTES))} minutes'
    returning key`;
  if (claimed.length === 0) return false;
  await runSync();
  return true;
}

export async function runSync(): Promise<void> {
  try {
    const [state] = await sql`
      select cursor from admin.sync_state where key = 'event_sync'`;
    const cursor = (state?.cursor ?? {}) as Record<string, string>;
    // Beim allerersten Lauf keine Rückwärts-Flut erzeugen:
    const fallback = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const since = {
      application: cursor.application ?? fallback,
      jobApplication: cursor.jobApplication ?? fallback,
      job: cursor.job ?? fallback,
      referral: cursor.referral ?? fallback,
    };
    const now = new Date().toISOString();
    const recipients = (await notifiableEmployees()).map((e) => e.id);

    // 1) Neue Kandidaten-Registrierungen → Benachrichtigung + automatische
    //    Anruf-Aufgabe (jede Registrierung soll angerufen werden).
    const newApps = await sql`
      select a.id, a."firstName", a."lastName", a.profession, a.phone, a.email,
             a."createdAt" as _ts, cm.assignee_id
      from admin.candidate a
      left join admin.candidate_meta cm on cm.application_id = a.id
      where a."createdAt" > ${since.application} and a.status <> 'ERASED'
      order by a."createdAt" limit 50`;
    for (const a of newApps) {
      await notify(
        recipients,
        "NEW_CANDIDATE",
        `Neuer Kandidat: ${a.firstName} ${a.lastName}`,
        a.profession ? `Beruf: ${a.profession}` : null,
        "candidate",
        a.id as string,
      );
      // Neue Registrierung → Status „Neu-Registrierung" (nur falls noch keiner gesetzt).
      await autoKandidatStatus(a.id as string, "NEU", []);
      // Anruf-Aufgabe einmalig je Kandidat (Registrierung).
      const name = `${a.firstName} ${a.lastName}`;
      const kontakt = [a.phone, a.email].filter(Boolean).join(" · ") || "keine Kontaktdaten";
      await sql`
        insert into admin.task
          (title, description, assignee_id, due_at, priority, status, entity_type, entity_id)
        select
          ${`Neuregistrierung anrufen: ${name}`},
          ${`${name} hat sich registriert und sollte kontaktiert werden — im Anruf-Interface werden passende Jobs und 3 Fragen vorbereitet. Kontakt: ${kontakt}`},
          ${a.assignee_id ?? null}, now() + interval '1 day', 'HOCH', 'OPEN',
          'candidate', ${a.id}
        where not exists (
          select 1 from admin.task t
          where t.entity_type = 'candidate' and t.entity_id = ${a.id}
            and t.title like 'Neuregistrierung anrufen:%' and t.deleted_at is null)`;
    }

    // 2) Neue Bewerbungen → Benachrichtigung + automatische Anruf-Aufgabe
    const newJobApps = await sql`
      select ja.id, j.title, c.name as company,
             u.email, u.phone, u."firstName", u."lastName",
             ja."createdAt" as _ts, cm.assignee_id
      from public."JobApplication" ja
      left join public."JobPosting" j on j.id = ja."jobPostingId"
      left join public."Company" c on c.id = j."companyId"
      left join public."User" u on u.id = ja."userId"
      left join admin.company_meta cm on cm.company_id = j."companyId"
      where ja."createdAt" > ${since.jobApplication}
      order by ja."createdAt" limit 50`;
    for (const b of newJobApps) {
      await notify(
        recipients,
        "NEW_APPLICATION",
        `Neue Bewerbung: ${b.title ?? "Stelle"}`,
        b.email ? `Bewerber: ${b.email}` : null,
        "application",
        b.id as string,
      );
      await createCallTaskForApplication(
        b as unknown as Parameters<typeof createCallTaskForApplication>[0],
      );
    }

    // 3) Neue Jobs
    const newJobs = await sql`
      select j.id, j.title, c.name as company, j."createdAt" as _ts
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j."createdAt" > ${since.job}
      order by j."createdAt" limit 50`;
    for (const j of newJobs) {
      await notify(
        recipients,
        "NEW_JOB",
        `Neue Stelle: ${j.title}`,
        j.company ? `Unternehmen: ${j.company}` : null,
        "job",
        j.id as string,
      );
    }

    // 3b) MATCHING-RADAR: für neue Jobs UND neue Kandidaten die Top-Matches
    //     (deterministisch, ohne KI) als Vorschläge einstellen + benachrichtigen.
    await radarFuerNeueJobs(newJobs.map((j) => j.id as string), recipients);
    await radarFuerNeueKandidaten(newApps.map((a) => a.id as string), recipients);

    // 4) Referral-Statusänderungen
    const changedReferrals = await sql`
      select r.id, r."candidateName", r.status, p.name as partner,
             r."updatedAt" as _ts
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where r."updatedAt" > ${since.referral} and r."createdAt" <= ${since.referral}
      order by r."updatedAt" limit 50`;
    for (const r of changedReferrals) {
      await notify(
        recipients,
        "REFERRAL_EVENT",
        `Referral-Status: ${r.candidateName ?? "Kandidat"} → ${r.status}`,
        r.partner ? `Partner: ${r.partner}` : null,
        "referral",
        r.id as string,
      );
    }

    // 5) Verpasste Termine: Endzeit vorbei, weder stattgefunden noch abgesagt
    //    → dringliche Benachrichtigung an den Verantwortlichen (einmalig).
    const missed = await sql`
      select a.id, a.title, a.ends_at, a.employee_id
      from admin.appointment a
      where a.deleted_at is null and a.status = 'PLANNED'
        and a.ends_at < now()
        and a.employee_id is not null
        and not exists (
          select 1 from admin.notification n
          where n.type = 'APPOINTMENT_MISSED'
            and n.entity_type = 'appointment' and n.entity_id = a.id::text)
      limit 50`;
    for (const a of missed) {
      await sql`
        insert into admin.notification
          (employee_id, type, title, body, entity_type, entity_id, priority)
        values (${a.employee_id}, 'APPOINTMENT_MISSED',
                ${`Termin verpasst: ${a.title}`},
                'Der Termin ist verstrichen, ohne als „Stattgefunden" oder „Abgesagt" markiert zu werden — bitte nachtragen.',
                'appointment', ${String(a.id)}, 'DRINGEND')`;
      await pushAnMitarbeiter([a.employee_id as string], {
        type: "APPOINTMENT_MISSED",
        title: `Termin verpasst: ${a.title}`,
        body: "Bitte als stattgefunden oder abgesagt nachtragen.",
        priority: "DRINGEND",
        entityType: "appointment",
        entityId: String(a.id),
      });
    }

    await runAutomations();
    // Fällige 8-Wochen-Treueprämien → finanzen-Aufgaben (Erinnerung).
    await erstelleFaelligeTreuepraemienAufgaben();
    // SLA-Wächter: zu lange im Status hängende Kandidaten → Nachfass-Aufgabe.
    try {
      await erstelleSlaNachfassAufgaben();
    } catch (e) {
      console.error("SLA-Wächter fehlgeschlagen", e);
    }
    // Autonomer Versand (nur wenn Master-Schalter AN + Vorlage aktiviert):
    // Inaktivitäts-Warnung an lange inaktive Kandidaten.
    try {
      await warneInaktiveKandidaten();
    } catch (e) {
      console.error("Autonome Inaktivitäts-Warnung fehlgeschlagen", e);
    }
    // Mitteilungszentrale: wahrgenommene Mitteilungen nach dem 30-s-Undo-Fenster
    // hart löschen (Speicher sparen; der zugrunde liegende Fakt bleibt bestehen).
    try {
      await raeumeWahrgenommeneMitteilungen();
    } catch (e) {
      console.error("Mitteilungs-Sweeper fehlgeschlagen", e);
    }
    // Auszahlungs-Register aktuell halten + ggf. automatisch abarbeiten.
    try {
      await backfillPayouts();
      await autoProcessPayouts();
    } catch (e) {
      console.error("Payout-Sync fehlgeschlagen", e);
    }
    await processOutbox();

    // Cursor NUR bis zum letzten tatsächlich verarbeiteten Zeitstempel je
    // Kategorie vorrücken — sonst gehen bei >50 neuen Einträgen (Limit) die
    // übersprungenen dauerhaft verloren. Bei leerem Batch bis `now` (sicher,
    // da die Abfrage bereits alles bis jetzt abgedeckt hätte).
    const letzterTs = (rows: readonly Record<string, unknown>[]): string => {
      if (!rows.length) return now;
      const ts = rows[rows.length - 1]._ts as string | Date;
      return ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();
    };
    await sql`
      update admin.sync_state
      set cursor = ${sql.json({
        application: letzterTs(newApps),
        jobApplication: letzterTs(newJobApps),
        job: letzterTs(newJobs),
        referral: letzterTs(changedReferrals),
      })}
      where key = 'event_sync'`;
  } catch (err) {
    console.error("event sync failed", err);
  }
}

/**
 * Matching-Radar: nutzt die kostenlose Engine, um für neue Jobs die besten
 * Kandidaten zu finden, legt Vorschläge an (admin.match_suggestion) und
 * benachrichtigt die Verantwortlichen. Schwelle/Top-N aus admin.setting.radar.
 */
async function radarSchwelle(): Promise<{ schwelle: number; topN: number }> {
  const [row] = await sql`select value from admin.setting where key = 'radar'`;
  const v = (row?.value ?? {}) as { schwelle?: number; top_n?: number };
  return { schwelle: v.schwelle ?? 75, topN: v.top_n ?? 5 };
}

async function radarFuerNeueJobs(jobIds: string[], recipients: string[]) {
  if (jobIds.length === 0) return;
  const { rankCandidatesForJob } = await import("./matching/rank");
  const { schwelle, topN } = await radarSchwelle();
  for (const jobId of jobIds) {
    try {
      const ranking = await rankCandidatesForJob(jobId);
      if (!ranking) continue;
      const [job] = await sql`
        select j.title, c.id as company_id, c.name as company_name,
               cm.assignee_id
        from public."JobPosting" j
        left join public."Company" c on c.id = j."companyId"
        left join admin.company_meta cm on cm.company_id = j."companyId"
        where j.id = ${jobId}`;
      const top = ranking.bewertet
        .filter((k) => !k.ohneKriterien && k.breakdown.score >= schwelle)
        .slice(0, topN);
      for (const k of top) {
        await sql`
          insert into admin.match_suggestion
            (application_id, candidate_name, job_posting_id, job_title,
             company_id, company_name, match_score, richtung, assignee_id)
          values (${k.applicationId}, ${k.name}, ${jobId}, ${job?.title ?? null},
                  ${(job?.company_id as string) ?? null}, ${(job?.company_name as string) ?? null},
                  ${k.breakdown.score}, 'KANDIDAT_FUER_JOB', ${(job?.assignee_id as string) ?? null})
          on conflict (application_id, job_posting_id) do nothing`;
      }
      if (top.length > 0) {
        await notify(
          job?.assignee_id ? [job.assignee_id as string] : recipients,
          "MATCH_RADAR",
          `${top.length} Top-Match${top.length > 1 ? "es" : ""} für „${job?.title ?? "Stelle"}"`,
          `Bester: ${top[0].name} (${top[0].breakdown.score} %)`,
          "job",
          jobId,
        );
      }
    } catch (err) {
      console.error("radarFuerNeueJobs", jobId, err);
    }
  }
}

async function radarFuerNeueKandidaten(appIds: string[], recipients: string[]) {
  if (appIds.length === 0) return;
  const { rankJobsForProfile } = await import("./matching/rank");
  const { schwelle, topN } = await radarSchwelle();
  for (const appId of appIds) {
    try {
      const [app] = await sql`
        select a.id, a."firstName", a."lastName", a.email, cm.assignee_id
        from admin.candidate a
        left join admin.candidate_meta cm on cm.application_id = a.id
        where a.id = ${appId} and a.status <> 'ERASED'`;
      if (!app) continue;
      const [user] = await sql`
        select "profileData" from public."User"
        where lower(email) = lower(${app.email as string}) and role = 'APPLICANT' limit 1`;
      if (!user) continue;
      const ergebnis = await rankJobsForProfile(user.profileData);
      const name = `${app.firstName} ${app.lastName}`;
      const top = ergebnis.matches
        .filter((m) => !m.ohneKriterien && m.breakdown.score >= schwelle)
        .slice(0, topN);
      for (const m of top) {
        await sql`
          insert into admin.match_suggestion
            (application_id, candidate_name, job_posting_id, job_title,
             company_id, company_name, match_score, richtung, assignee_id)
          values (${appId}, ${name}, ${m.jobId}, ${m.title},
                  ${m.companyId}, ${m.companyName}, ${m.breakdown.score},
                  'JOB_FUER_KANDIDAT', ${(app.assignee_id as string) ?? null})
          on conflict (application_id, job_posting_id) do nothing`;
      }
      if (top.length > 0) {
        await notify(
          app.assignee_id ? [app.assignee_id as string] : recipients,
          "MATCH_RADAR",
          `${top.length} passende Stelle${top.length > 1 ? "n" : ""} für ${name}`,
          `Beste: ${top[0].title} (${top[0].breakdown.score} %)`,
          "candidate",
          appId,
        );
      }
    } catch (err) {
      console.error("radarFuerNeueKandidaten", appId, err);
    }
  }
}

/** Führt aktivierte Automationen aus (unterstützte Trigger). */
async function runAutomations(): Promise<void> {
  const automations = await sql`
    select id, name, trigger, conditions, actions
    from admin.automation
    where enabled = true and deleted_at is null`;

  for (const auto of automations) {
    try {
      let matched = 0;
      let done = 0;
      const actions = (auto.actions ?? []) as Array<{ type: string; templateId?: string }>;

      if (auto.trigger === "APPLICATION_STALE") {
        // Bewerbungen, die seit >5 Tagen unbeantwortet (SENT) sind und noch
        // keine offene Automations-Aufgabe haben.
        const stale = await sql`
          select ja.id, j.title, u.email
          from public."JobApplication" ja
          left join public."JobPosting" j on j.id = ja."jobPostingId"
          left join public."User" u on u.id = ja."userId"
          where ja.status = 'SENT'
            and ja."createdAt" < now() - interval '5 days'
            and not exists (
              select 1 from admin.task t
              where t.entity_type = 'application' and t.entity_id = ja.id
                and t.deleted_at is null)
          limit 20`;
        matched = stale.length;
        for (const s of stale) {
          for (const action of actions) {
            if (action.type === "CREATE_TASK") {
              await sql`
                insert into admin.task (title, description, priority, entity_type, entity_id)
                values (${`Bewerbung nachfassen: ${s.title ?? "Stelle"}`},
                        ${`Automatisch erstellt — Bewerbung von ${s.email ?? "unbekannt"} ist seit über 5 Tagen unbeantwortet.`},
                        'HOCH', 'application', ${s.id})`;
              done++;
            }
          }
        }
      }

      if (auto.trigger === "INTERVIEW_UPCOMING") {
        const upcoming = await sql`
          select a.id, a.title, a.starts_at, a.employee_id
          from admin.appointment a
          where a.deleted_at is null and a.status = 'PLANNED'
            and a.starts_at between now() and now() + interval '24 hours'
            and not exists (
              select 1 from admin.notification n
              where n.type = 'APPOINTMENT_REMINDER'
                and n.entity_type = 'appointment' and n.entity_id = a.id::text)`;
        matched = upcoming.length;
        for (const a of upcoming) {
          if (a.employee_id) {
            await sql`
              insert into admin.notification
                (employee_id, type, title, body, entity_type, entity_id, priority)
              values (${a.employee_id}, 'APPOINTMENT_REMINDER',
                      ${`Termin in unter 24 h: ${a.title}`}, null,
                      'appointment', ${String(a.id)}, 'HOCH')`;
            await pushAnMitarbeiter([a.employee_id as string], {
              type: "APPOINTMENT_REMINDER",
              title: `Termin in unter 24 h: ${a.title}`,
              priority: "HOCH",
              entityType: "appointment",
              entityId: String(a.id),
            });
            done++;
          }
        }
      }

      if (
        auto.trigger === "NEW_CANDIDATE" &&
        actions.some((a) => a.type === "SEND_TEMPLATE")
      ) {
        // Begrüßungs-Mail an neue Kandidaten der letzten 24 h, die noch keine
        // Automations-Mail bekommen haben.
        const action = actions.find((a) => a.type === "SEND_TEMPLATE");
        const [template] = action?.templateId
          ? await sql`
              select subject, body from admin.template
              where id = ${action.templateId} and deleted_at is null`
          : [];
        if (template) {
          const fresh = await sql`
            select a.id, a."firstName", a."lastName", a.email
            from admin.candidate a
            where a."createdAt" > now() - interval '24 hours'
              and a.status <> 'ERASED'
              and not exists (
                select 1 from admin.outbox_email o
                where o.entity_type = 'candidate' and o.entity_id = a.id
                  and o.kind = 'AUTOMATION')
            limit 20`;
          matched = fresh.length;
          for (const c of fresh) {
            const vars = {
              first_name: c.firstName as string,
              last_name: c.lastName as string,
              company: "Werkpair",
              job_title: "",
            };
            const rendered = renderBrandedText(
              renderTemplate((template.subject as string) ?? "", vars),
              renderTemplate(template.body as string, vars),
            );
            await queueEmail({
              toEmail: c.email as string,
              toName: `${c.firstName} ${c.lastName}`,
              subject: rendered.subject,
              body: rendered.text,
              html: rendered.html,
              kind: "AUTOMATION",
              entityType: "candidate",
              entityId: c.id as string,
            });
            done++;
          }
        }
      }

      // NEW_CANDIDATE → CREATE_TASK (zusätzliche Prüf-Aufgabe je neuem Kandidat).
      if (
        auto.trigger === "NEW_CANDIDATE" &&
        actions.some((a) => a.type === "CREATE_TASK")
      ) {
        const fresh = await sql`
          select a.id, a."firstName", a."lastName"
          from admin.candidate a
          where a."createdAt" > now() - interval '24 hours' and a.status <> 'ERASED'
            and not exists (
              select 1 from admin.task t
              where t.entity_type='candidate' and t.entity_id=a.id
                and t.title like 'Automatisierung:%' and t.deleted_at is null)
          limit 20`;
        matched = Math.max(matched, fresh.length);
        for (const c of fresh) {
          await sql`
            insert into admin.task (title, description, priority, entity_type, entity_id)
            values (${`Automatisierung: ${c.firstName} ${c.lastName} prüfen`},
                    'Automatisch erstellt bei neuer Registrierung.', 'NORMAL', 'candidate', ${c.id})`;
          done++;
        }
      }

      // NEW_APPLICATION → Aufgabe und/oder Vorlage an den Bewerber.
      if (auto.trigger === "NEW_APPLICATION") {
        const apps = await sql`
          select ja.id, j.title, u.email, u."firstName", u."lastName"
          from public."JobApplication" ja
          left join public."JobPosting" j on j.id = ja."jobPostingId"
          left join public."User" u on u.id = ja."userId"
          where ja."createdAt" > now() - interval '24 hours'
          order by ja."createdAt" desc limit 20`;
        matched = apps.length;
        const tplAction = actions.find((a) => a.type === "SEND_TEMPLATE");
        const [template] = tplAction?.templateId
          ? await sql`select subject, body from admin.template where id = ${tplAction.templateId} and deleted_at is null`
          : [];
        for (const a of apps) {
          for (const action of actions) {
            if (action.type === "CREATE_TASK") {
              const [ex] = await sql`
                select 1 from admin.task where entity_type='application' and entity_id=${a.id}
                  and title like 'Bewerbung bearbeiten:%' and deleted_at is null limit 1`;
              if (!ex) {
                await sql`
                  insert into admin.task (title, description, priority, entity_type, entity_id)
                  values (${`Bewerbung bearbeiten: ${a.title ?? "Stelle"}`},
                          ${`Automatisch — neue Bewerbung von ${a.email ?? "unbekannt"}.`},
                          'NORMAL', 'application', ${a.id})`;
                done++;
              }
            } else if (action.type === "SEND_TEMPLATE" && template && a.email) {
              const [ex] = await sql`
                select 1 from admin.outbox_email where entity_type='application' and entity_id=${a.id}
                  and kind='AUTOMATION' limit 1`;
              if (!ex) {
                const vars = {
                  first_name: a.firstName as string,
                  last_name: a.lastName as string,
                  company: "Werkpair",
                  job_title: (a.title as string) ?? "",
                };
                const rendered = renderBrandedText(
                  renderTemplate((template.subject as string) ?? "", vars),
                  renderTemplate(template.body as string, vars),
                );
                await queueEmail({
                  toEmail: a.email as string,
                  toName: `${a.firstName} ${a.lastName}`,
                  subject: rendered.subject,
                  body: rendered.text,
                  html: rendered.html,
                  kind: "AUTOMATION",
                  entityType: "application",
                  entityId: a.id as string,
                });
                done++;
              }
            }
          }
        }
      }

      // NEW_JOB → Prüf-/Staffing-Aufgabe je neuer Stelle.
      if (auto.trigger === "NEW_JOB" && actions.some((a) => a.type === "CREATE_TASK")) {
        const jobs = await sql`
          select j.id, j.title, c.name as company
          from public."JobPosting" j
          left join public."Company" c on c.id = j."companyId"
          where j."createdAt" > now() - interval '24 hours'
          order by j."createdAt" desc limit 20`;
        matched = jobs.length;
        for (const j of jobs) {
          const [ex] = await sql`
            select 1 from admin.task where entity_type='job' and entity_id=${j.id}
              and title like 'Neue Stelle prüfen:%' and deleted_at is null limit 1`;
          if (!ex) {
            await sql`
              insert into admin.task (title, description, priority, entity_type, entity_id)
              values (${`Neue Stelle prüfen: ${j.title}`},
                      ${`Automatisch — neue Stelle${j.company ? ` bei ${j.company}` : ""}. Kriterien pflegen und passende Kandidaten prüfen.`},
                      'NORMAL', 'job', ${j.id})`;
            done++;
          }
        }
      }

      if (matched > 0) {
        await sql`
          insert into admin.automation_run (automation_id, trigger, matched, actions_done)
          values (${auto.id}, ${auto.trigger}, ${matched}, ${done})`;
      }
    } catch (err) {
      console.error(`automation ${auto.name} failed`, err);
    }
  }
}
