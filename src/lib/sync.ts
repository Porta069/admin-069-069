import "server-only";
import { sql } from "./db";
import { processOutbox, queueEmail, renderTemplate } from "./mailer";

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

    // 1) Neue Kandidaten-Registrierungen
    const newApps = await sql`
      select id, "firstName", "lastName", profession
      from public."Application"
      where "createdAt" > ${since.application} and status <> 'ERASED'
      order by "createdAt" limit 50`;
    for (const a of newApps) {
      await notify(
        recipients,
        "NEW_CANDIDATE",
        `Neuer Kandidat: ${a.firstName} ${a.lastName}`,
        a.profession ? `Beruf: ${a.profession}` : null,
        "candidate",
        a.id as string,
      );
    }

    // 2) Neue Bewerbungen → Benachrichtigung + automatische Anruf-Aufgabe
    const newJobApps = await sql`
      select ja.id, j.title, c.name as company,
             u.email, u.phone, u."firstName", u."lastName",
             cm.assignee_id
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
      select j.id, j.title, c.name as company
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

    // 4) Referral-Statusänderungen
    const changedReferrals = await sql`
      select r.id, r."candidateName", r.status, p.name as partner
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
    }

    await runAutomations();
    await processOutbox();

    await sql`
      update admin.sync_state
      set cursor = ${sql.json({
        application: now,
        jobApplication: now,
        job: now,
        referral: now,
      })}
      where key = 'event_sync'`;
  } catch (err) {
    console.error("event sync failed", err);
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
            from public."Application" a
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
              company: "PORTAWERK",
              job_title: "",
            };
            await queueEmail({
              toEmail: c.email as string,
              toName: `${c.firstName} ${c.lastName}`,
              subject: renderTemplate((template.subject as string) ?? "", vars),
              body: renderTemplate(template.body as string, vars),
              kind: "AUTOMATION",
              entityType: "candidate",
              entityId: c.id as string,
            });
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
