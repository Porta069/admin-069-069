import "server-only";
import { sql } from "./db";
import { renderVorlageEmail, type VorlageDaten } from "./email-templates";

/**
 * Autonomer Ereignis-Versand.
 *
 * SICHERHEIT: Es wird NICHTS automatisch versendet, solange nicht BEIDES gilt:
 *  1. der globale Master-Schalter `admin.setting key='autonomer_versand'.aktiv` = true, UND
 *  2. die jeweilige Vorlage `admin.benachrichtigung_vorlage.enabled` = true.
 * Der Master-Schalter ist standardmäßig AUS (Zeile fehlt = aus). So kann nichts
 * versehentlich doppelt zu Plattform-Mails an echte Nutzer geraten.
 */

/** Ist der globale autonome Versand aktiviert? (Standard: nein) */
export async function autonomerVersandAktiv(): Promise<boolean> {
  const [row] = await sql`select value from admin.setting where key = 'autonomer_versand'`;
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return v.aktiv === true;
}

/**
 * Reiht — sofern global aktiv UND die Vorlage aktiviert ist — die Ereignis-Mail
 * an einen Kandidaten in die Outbox ein. Idempotent: dieselbe Ereignis-Mail geht
 * nicht erneut an dieselbe Person innerhalb von `entsperreTage` Tagen raus.
 * Rückgabe: wurde eine Mail eingereiht?
 */
export async function dispatchEreignisMail(
  event: string,
  applicationId: string,
  vars: Record<string, string> = {},
  opts: { entsperreTage?: number } = {},
): Promise<boolean> {
  if (!(await autonomerVersandAktiv())) return false;

  const [v] = await sql`
    select variante, titel, betreff, einleitung, schluss, hervorhebung, code, enabled
    from admin.benachrichtigung_vorlage where event = ${event} limit 1`;
  if (!v || v.enabled !== true) return false;

  const [c] = await sql`
    select id, "firstName", "lastName", email from admin.candidate
    where id = ${applicationId} and status <> 'ERASED' limit 1`;
  if (!c?.email) return false;

  // Idempotenz: nicht erneut senden, wenn dieselbe Ereignis-Mail kürzlich raus ist.
  const tage = Math.max(1, Math.floor(opts.entsperreTage ?? 30));
  const [schonDa] = await sql`
    select 1 from admin.outbox_email
    where entity_type = 'candidate' and entity_id = ${applicationId}
      and event_code = ${(v.code as number | null) ?? null}
      and created_at > now() - make_interval(days => ${tage})
    limit 1`;
  if (schonDa) return false;

  const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Kandidat";
  const heute = new Intl.DateTimeFormat("de-DE").format(new Date());
  const merged: Record<string, string> = {
    name,
    email: c.email as string,
    datum: heute,
  };
  for (const [k, val] of Object.entries(vars)) merged[k] = String(val ?? "");

  const { subject, text, html } = renderVorlageEmail(v as VorlageDaten, merged);

  await sql`
    insert into admin.outbox_email
      (to_email, to_name, subject, body, html, kind, entity_type, entity_id, event_code)
    values (${c.email as string}, ${name}, ${subject}, ${text}, ${html},
            'SYSTEM', 'candidate', ${applicationId}, ${(v.code as number | null) ?? null})`;
  return true;
}

/**
 * Dashboard-eigener Trigger: Kandidaten ohne jede Aktivität seit N Tagen (nicht
 * vermittelt) erhalten die „Inaktivitäts-Warnung"-Vorlage — sofern autonomer
 * Versand aktiv und die Vorlage aktiviert ist. Schwelle via setting `sla`
 * (`inactivity_days`, Standard 30). Wird vom Sync-Runner aufgerufen.
 */
export async function warneInaktiveKandidaten(): Promise<number> {
  if (!(await autonomerVersandAktiv())) return 0;

  const [slaRow] = await sql`select value from admin.setting where key = 'sla'`;
  const sv = (slaRow?.value ?? {}) as Record<string, unknown>;
  const tage = Math.max(7, Math.floor(typeof sv.inactivity_days === "number" ? sv.inactivity_days : 30));

  const rows = await sql`
    select a.id
    from admin.candidate a
    left join admin.candidate_meta cm on cm.application_id = a.id
    where a.status <> 'ERASED'
      and coalesce(cm.status, '') not in ('ANGENOMMEN', 'ABGELEHNT', 'KEIN_INTERESSE', 'INAKTIV')
      and a."updatedAt" < now() - make_interval(days => ${tage})
      and not exists (
        select 1 from admin.communication k
        where k.entity_type = 'candidate' and k.entity_id = a.id
          and k.deleted_at is null
          and k.occurred_at > now() - make_interval(days => ${tage}))
    order by a."updatedAt" asc
    limit 50`;

  let versendet = 0;
  for (const r of rows) {
    if (await dispatchEreignisMail("inaktivitaet_warnung", r.id as string, {}, { entsperreTage: tage })) {
      versendet++;
    }
  }
  return versendet;
}
