import "server-only";
import { sql } from "./db";
import { formatEuroCents } from "./format";
import { renderVorlageEmail } from "./email-templates";
import { processOutbox } from "./mailer";
import { AFFILIATE_BONUS_CENTS, RETENTION_CENTS, RETENTION_WEEKS } from "./rewards";
import * as backend from "./backend";

/**
 * Einheitliches Auszahlungs-Register (admin.payout). Führt alle Prämientypen
 * — Empfehlungsprämie, Affiliate-Bonus und Treueprämie — als nachverfolgbare
 * Auszahlungen mit Lebenszyklus, Bankdaten, Beleg (admin.invoice) und E-Mail.
 *
 * Erzeugung ist idempotent (ein Datensatz je Quelle über den Unique-Index
 * art+entity_type+entity_id). Das eigentliche Überweisen bleibt manuell/über das
 * Bankmodul — hier wird nichts Fiktives gebucht.
 */

export interface PayoutRow {
  id: string;
  art: string;
  status: string;
  recipient_name: string;
  recipient_email: string | null;
  amount_cents: number;
  bank_holder: string | null;
  bank_iban: string | null;
  referral_id: string | null;
  placement_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  invoice_id: string | null;
}

async function referralRewardCents(): Promise<number> {
  const [row] = await sql`select value from admin.setting where key = 'pricing'`;
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return typeof v.referral_reward_cents === "number" ? v.referral_reward_cents : 10000;
}

/** Ist die Auszahlungs-Automatisierung aktiviert? */
export async function payoutAutoAktiv(): Promise<boolean> {
  const [row] = await sql`select value from admin.setting where key = 'payouts'`;
  const v = (row?.value ?? {}) as Record<string, unknown>;
  return v.auto === true;
}

/**
 * Erzeugt fehlende Auszahlungen aus allen Quellen (idempotent). Gibt die Anzahl
 * neu angelegter Datensätze zurück.
 */
export async function backfillPayouts(): Promise<number> {
  const fallback = await referralRewardCents();

  // 1) Empfehlungsprämien (Backend-Referral: PLACED/PAID).
  const ref = await sql`
    insert into admin.payout
      (art, status, recipient_name, recipient_kind, amount_cents,
       bank_holder, bank_iban, entity_type, entity_id, referral_id, due_at, paid_at)
    select 'REFERRAL',
           case when r.status = 'PAID' then 'AUSGEZAHLT' else 'OFFEN' end,
           coalesce(p.name, 'Partner'), 'partner',
           case when coalesce(r."rewardCents", 0) = 0 then ${fallback}::int else r."rewardCents" end,
           p."payoutHolder", p."payoutIban",
           'referral', r.id, r.id, r."placedAt",
           case when r.status = 'PAID' then r."paidAt" else null end
    from public."Referral" r
    left join public."Partner" p on p.id = r."partnerId"
    where r.status in ('PLACED', 'PAID')
    on conflict (art, entity_type, entity_id) where deleted_at is null do nothing
    returning id`;

  // 2) Affiliate-Boni (Kandidat über Affiliate-Link geworben → an den Werber).
  const aff = await sql`
    insert into admin.payout
      (art, status, recipient_name, recipient_kind, amount_cents,
       entity_type, entity_id, placement_id, due_at)
    select 'AFFILIATE', 'OFFEN', trim(u."referredBy"), 'werber',
           ${AFFILIATE_BONUS_CENTS}::int,
           'candidate', pl.application_id, pl.id, pl.placed_at
    from admin.placement pl
    join public."User" u on u.id = pl.application_id
    where pl.deleted_at is null and pl.status <> 'CANCELLED'
      and u."referredBy" is not null and trim(u."referredBy") <> ''
      and lower(trim(u."referredBy")) not in ('-','—','–','none','null','kein','keine','n/a','na')
    on conflict (art, entity_type, entity_id) where deleted_at is null do nothing
    returning id`;

  // 3) Treueprämien (jede Vermittlung mit Retention-Fälligkeit).
  const ret = await sql`
    insert into admin.payout
      (art, status, recipient_name, recipient_kind, amount_cents,
       entity_type, entity_id, placement_id, due_at, paid_at)
    select 'RETENTION',
           case when pl.retention_paid_at is not null then 'AUSGEZAHLT' else 'OFFEN' end,
           coalesce(pl.candidate_name, 'Kandidat'), 'candidate',
           ${RETENTION_CENTS}::int,
           'placement', pl.id, pl.id, pl.retention_due_at, pl.retention_paid_at
    from admin.placement pl
    where pl.deleted_at is null and pl.status <> 'CANCELLED'
      and pl.retention_due_at is not null
    on conflict (art, entity_type, entity_id) where deleted_at is null do nothing
    returning id`;

  return ref.length + aff.length + ret.length;
}

const ART_LABEL: Record<string, string> = {
  REFERRAL: "Empfehlungsprämie",
  AFFILIATE: "Affiliate-Bonus",
  RETENTION: "Treueprämie",
  SONSTIGE: "Prämie",
};

/** Erzeugt einen Auszahlungs-Beleg (admin.invoice, Gutschrift) und verknüpft ihn. */
export async function generatePayoutBeleg(
  p: PayoutRow,
  actorId: string | null,
): Promise<string> {
  // Idempotenz: existiert bereits ein Beleg zu dieser Auszahlung, diesen nehmen.
  const [vorhanden] = await sql`
    select id from admin.invoice where payout_id = ${p.id} and deleted_at is null limit 1`;
  if (vorhanden) return vorhanden.id as string;

  const betrag = p.amount_cents;
  const bez = `${ART_LABEL[p.art] ?? "Prämie"} — Auszahlung an ${p.recipient_name}`;
  const positionen = [
    { bezeichnung: bez, menge: 1, einzelpreis_cents: betrag, betrag_cents: betrag },
  ];
  try {
    const [inv] = await sql`
      insert into admin.invoice (
        nummer, art, company_name, recipient_name,
        base_fee_cents, commission_cents, total_cents, tax_rate, positionen,
        notes, status, issued_at, service_date, due_at, created_by, payout_id
      ) values (
        'PA-' || extract(year from (now() at time zone 'Europe/Berlin'))::int
          || '-' || nextval('admin.invoice_seq'),
        'PRAEMIE', ${p.recipient_name}, ${p.recipient_name},
        ${betrag}, 0, ${betrag}, 0, ${sql.json(positionen)},
        ${`Prämien-Auszahlung (${ART_LABEL[p.art] ?? "Prämie"})`}, 'BEZAHLT',
        now(), current_date, now(), ${actorId}, ${p.id})
      returning id`;
    return inv.id as string;
  } catch (e) {
    // Paralleler Lauf hat den Beleg gerade angelegt (Unique-Index) → diesen nehmen.
    const [again] = await sql`
      select id from admin.invoice where payout_id = ${p.id} and deleted_at is null limit 1`;
    if (again) return again.id as string;
    throw e;
  }
}

/** Rendert + verschickt die Auszahlungs-Bestätigung (echte Outbox → Brevo). */
export async function sendPayoutEmail(payoutId: string): Promise<boolean> {
  const [p] = await sql`
    select po.*, i.nummer as beleg_nr
    from admin.payout po
    left join admin.invoice i on i.id = po.invoice_id
    where po.id = ${payoutId} and po.deleted_at is null`;
  if (!p || !p.recipient_email) return false;

  const betrag = formatEuroCents(p.amount_cents as number);
  const artLabel = ART_LABEL[p.art as string] ?? "Prämie";
  const belegNr = p.beleg_nr ? ` (Beleg ${p.beleg_nr as string})` : "";
  const { subject, text, html } = renderVorlageEmail(
    {
      variante: "brief",
      titel: "Deine Prämie wurde ausgezahlt",
      betreff: `${artLabel}: ${betrag} ausgezahlt`,
      einleitung:
        `hallo ${p.recipient_name as string},\n\n` +
        `deine ${artLabel} in Höhe von ${betrag} wurde soeben zur Auszahlung freigegeben${belegNr}. ` +
        `Der Betrag wird per Überweisung ausgezahlt.`,
      schluss: "Vielen Dank und beste Grüße\nDein Porta-Team",
      hervorhebung: `${betrag} — ${artLabel}`,
    },
    {},
  );

  const [mail] = await sql`
    insert into admin.outbox_email
      (to_email, to_name, subject, body, html, kind, entity_type, entity_id, event_code, created_by)
    values (${p.recipient_email}, ${p.recipient_name}, ${subject}, ${text}, ${html},
            'payout', 'payout', ${payoutId}, 'payout_paid', ${p.paid_by ?? p.created_by ?? null})
    returning id`;
  try {
    await processOutbox();
  } catch (e) {
    console.error("processOutbox (payout) fehlgeschlagen", e);
  }
  void mail;
  await sql`update admin.payout set email_sent_at = now(), updated_at = now() where id = ${payoutId}`;
  return true;
}

/**
 * Auszahlung abschließen: Status → AUSGEZAHLT, typspezifische Nebenwirkungen
 * (Referral-Backend PAID, Treueprämie retention_paid_at), Beleg erzeugen und
 * optional Bestätigungs-E-Mail versenden.
 */
export async function settlePayout(
  payoutId: string,
  actorId: string | null,
  opts: { sendEmail?: boolean } = {},
): Promise<
  | { ok: true; emailed: boolean; message: string }
  | { ok: false; message: string }
> {
  const [p] = await sql<PayoutRow[]>`
    select * from admin.payout where id = ${payoutId} and deleted_at is null`;
  if (!p) return { ok: false, message: "Auszahlung wurde nicht gefunden." };
  if (p.status === "AUSGEZAHLT") return { ok: false, message: "Bereits ausgezahlt." };
  if (p.status === "STORNIERT") return { ok: false, message: "Diese Auszahlung ist storniert." };

  // Referral-Prämien laufen über das Backend (Plattform-Prämienlogik).
  if (p.art === "REFERRAL" && p.referral_id) {
    try {
      await backend.setReferralStatus(p.referral_id, "PAID");
    } catch (e) {
      console.error("backend.setReferralStatus (payout) failed", e);
      return {
        ok: false,
        message: "Das Backend wacht gerade auf (Render-Kaltstart) — bitte in ein paar Sekunden erneut versuchen.",
      };
    }
  }
  // Treueprämie: Vermittlung als ausgezahlt markieren.
  if (p.art === "RETENTION" && p.placement_id) {
    await sql`
      update admin.placement set retention_paid_at = now(), updated_at = now()
      where id = ${p.placement_id} and retention_paid_at is null`;
  }

  // Beleg (Gutschrift) erzeugen, falls noch keiner existiert.
  const invoiceId = p.invoice_id ?? (await generatePayoutBeleg(p, actorId));

  await sql`
    update admin.payout
    set status = 'AUSGEZAHLT', paid_at = now(), paid_by = ${actorId},
        invoice_id = ${invoiceId}, updated_at = now()
    where id = ${payoutId}`;

  let emailed = false;
  if (opts.sendEmail && p.recipient_email) {
    try {
      emailed = await sendPayoutEmail(payoutId);
    } catch (e) {
      console.error("sendPayoutEmail failed", e);
    }
  }

  const teile = ["Als ausgezahlt markiert", "Beleg erstellt"];
  if (opts.sendEmail) teile.push(emailed ? "E-Mail versendet" : "E-Mail nicht versendet (keine Adresse)");
  return { ok: true, emailed, message: teile.join(" · ") + "." };
}

/**
 * Automatischer Lauf (täglicher Sync): wenn aktiviert, werden GENEHMIGTE
 * Auszahlungen mit hinterlegter IBAN als ausgezahlt markiert — inkl. Beleg und
 * (falls E-Mail vorhanden) Bestätigungs-E-Mail. Die Überweisung selbst bleibt
 * manuell/über das Bankmodul; hier wird nichts Fiktives gebucht.
 */
export async function autoProcessPayouts(): Promise<{ settled: number; skipped: number }> {
  if (!(await payoutAutoAktiv())) return { settled: 0, skipped: 0 };
  const rows = await sql`
    select id, recipient_email from admin.payout
    where deleted_at is null and status = 'GENEHMIGT' and bank_iban is not null
    order by due_at asc nulls last limit 200`;
  let settled = 0, skipped = 0;
  for (const r of rows) {
    const res = await settlePayout(r.id as string, null, { sendEmail: Boolean(r.recipient_email) });
    if (res.ok) settled++;
    else skipped++;
  }
  return { settled, skipped };
}

export { RETENTION_WEEKS };
