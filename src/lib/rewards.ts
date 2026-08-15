import "server-only";
import { sql } from "./db";
import { formatEuroCents } from "./format";

/**
 * Kandidaten-Belohnungen rund um eine Vermittlung.
 *
 *  • Affiliate-Bonus: Kam der Kandidat über einen Affiliate-Link
 *    (public."User".referredBy gesetzt), erhält die Person nach der
 *    Vermittlung 20 €. Wir legen dafür automatisch eine Aufgabe mit dem
 *    Tag „finanzen" an (Überweisung).
 *  • Treueprämie: Jeder vermittelte Kandidat bekommt 8 Wochen nach der
 *    Vermittlung 200 € Belohnung (admin.placement.retention_due_at /
 *    retention_paid_at). Fällige Prämien erzeugen — analog — eine
 *    finanzen-Aufgabe (siehe sync.ts).
 */

export const AFFILIATE_BONUS_CENTS = 2000; // 20 €
export const RETENTION_CENTS = 20000; // 200 €
export const RETENTION_WEEKS = 8;
export const RETENTION_DAYS = RETENTION_WEEKS * 7; // 56

/** Werte, die faktisch „kein Referrer" bedeuten, obwohl das Feld gefüllt ist. */
const LEER = new Set(["", "-", "—", "–", "none", "null", "kein", "keine", "n/a", "na"]);

export function istAffiliateHerkunft(
  referredBy: string | null | undefined,
): boolean {
  if (!referredBy) return false;
  return !LEER.has(referredBy.trim().toLowerCase());
}

/** „finanzen"-Tag holen oder anlegen; gibt die Tag-ID zurück. */
async function finanzenTagId(): Promise<string> {
  const [vorhanden] = await sql`
    select id from admin.tag where lower(name) = 'finanzen' limit 1`;
  if (vorhanden) return vorhanden.id as string;
  const [neu] = await sql`
    insert into admin.tag (name, color) values ('finanzen', '#115F5B')
    returning id`;
  return neu.id as string;
}

/** Tag idempotent an eine Entität hängen. */
async function tagEntity(
  tagId: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await sql`
    insert into admin.entity_tag (tag_id, entity_type, entity_id)
    select ${tagId}, ${entityType}, ${entityId}
    where not exists (
      select 1 from admin.entity_tag
      where tag_id = ${tagId} and entity_type = ${entityType}
        and entity_id = ${entityId})`;
}

/**
 * Nach einer Vermittlung: falls Affiliate-Herkunft, eine finanzen-Aufgabe für
 * die 20-€-Auszahlung an den Kandidaten anlegen (einmalig je Kandidat).
 * `placementId` dient nur der Nachverfolgung; verknüpft wird mit dem Kandidaten.
 */
export async function erstelleAffiliateBonusAufgabe(
  placementId: string,
): Promise<void> {
  const [pl] = await sql`
    select application_id, candidate_name, company_name
    from admin.placement where id = ${placementId}`;
  if (!pl?.application_id) return;
  const applicationId = pl.application_id as string;

  const [user] = await sql`
    select "referredBy" from public."User" where id = ${applicationId} limit 1`;
  const referredBy = user?.referredBy as string | null | undefined;
  if (!istAffiliateHerkunft(referredBy)) return;

  // Dedupe: nur eine Affiliate-Bonus-Aufgabe je Kandidat.
  const vorhanden = await sql`
    select 1 from admin.task
    where entity_type = 'candidate' and entity_id = ${applicationId}
      and title like 'Affiliate-Bonus%' and deleted_at is null
    limit 1`;
  if (vorhanden.length > 0) return;

  const betrag = formatEuroCents(AFFILIATE_BONUS_CENTS);
  const name = (pl.candidate_name as string) || "Kandidat";
  const firma = pl.company_name ? ` (${pl.company_name as string})` : "";
  const [task] = await sql`
    insert into admin.task
      (title, description, due_at, priority, status, entity_type, entity_id)
    values (
      ${`Affiliate-Bonus auszahlen: ${name}`},
      ${`${name} kam über einen Affiliate-Link (Empfehlung: „${(referredBy as string).trim()}") und wurde vermittelt${firma}. Bitte ${betrag} an die Person überweisen — Kontodaten ggf. beim Kandidaten erfragen.`},
      now() + interval '7 days', 'NORMAL', 'OPEN', 'candidate', ${applicationId})
    returning id`;

  const tagId = await finanzenTagId();
  await tagEntity(tagId, "task", task.id as string);
}

/**
 * Für alle fälligen, noch nicht ausgezahlten Treueprämien eine finanzen-Aufgabe
 * anlegen (einmalig je Kandidat). Wird vom Sync-Runner aufgerufen. Gibt die
 * Anzahl neu erstellter Aufgaben zurück.
 */
export async function erstelleFaelligeTreuepraemienAufgaben(): Promise<number> {
  const faellig = await sql`
    select id, application_id, candidate_name, company_name
    from admin.placement
    where deleted_at is null and status <> 'CANCELLED'
      and retention_paid_at is null
      and retention_due_at is not null and retention_due_at <= now()
      and application_id is not null
    limit 100`;
  if (faellig.length === 0) return 0;

  const tagId = await finanzenTagId();
  const betrag = formatEuroCents(RETENTION_CENTS);
  let erstellt = 0;
  for (const pl of faellig) {
    const applicationId = pl.application_id as string;
    const schonDa = await sql`
      select 1 from admin.task
      where entity_type = 'candidate' and entity_id = ${applicationId}
        and title like 'Treueprämie%' and deleted_at is null
      limit 1`;
    if (schonDa.length > 0) continue;

    const name = (pl.candidate_name as string) || "Kandidat";
    const firma = pl.company_name ? ` bei ${pl.company_name as string}` : "";
    const [task] = await sql`
      insert into admin.task
        (title, description, due_at, priority, status, entity_type, entity_id)
      values (
        ${`Treueprämie auszahlen: ${name}`},
        ${`${name} ist seit ${RETENTION_WEEKS} Wochen vermittelt${firma} — die Treueprämie von ${betrag} ist fällig. Bitte überweisen und in „Vermittlungen → Treueprämien" als ausgezahlt markieren.`},
        now(), 'HOCH', 'OPEN', 'candidate', ${applicationId})
      returning id`;
    await tagEntity(tagId, "task", task.id as string);
    erstellt++;
  }
  return erstellt;
}
