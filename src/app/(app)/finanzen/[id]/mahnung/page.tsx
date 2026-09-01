import { notFound, redirect } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
import { DokumentWerkbank } from "@/components/dokumente/dokument-werkbank";
import { SENDER_DEFAULT, RECHNUNG_FELDER } from "@/lib/dokumente/felder";
import type { FeldWerte, Position } from "@/lib/dokumente/typen";
import { MahnungConfirm } from "../../_components/mahnung-confirm";

/** Mahnstufe (1 = Zahlungserinnerung) → Titel + Mahngebühr. */
function stufeInfo(stufe: number) {
  if (stufe <= 1) return { titel: "Zahlungserinnerung", gebuehrCents: 0, freundlich: true };
  if (stufe === 2) return { titel: "1. Mahnung", gebuehrCents: 500, freundlich: false };
  if (stufe === 3) return { titel: "2. Mahnung", gebuehrCents: 1000, freundlich: false };
  return { titel: "Letzte Mahnung", gebuehrCents: 1500, freundlich: false };
}

export default async function MahnungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEmployee("rewards", "edit");
  const { id } = await params;

  const [invoice] = await sql`
    select i.*, pl.candidate_name, pl.job_title
    from admin.invoice i
    left join admin.placement pl on pl.id = i.placement_id
    where i.id = ${id} and i.deleted_at is null
    limit 1`;
  if (!invoice) notFound();
  if (invoice.status !== "OFFEN" && invoice.status !== "UEBERFAELLIG") {
    redirect(`/finanzen/${id}`);
  }

  const company = invoice.company_id
    ? (
        await sql`
          select name, strasse, plz, ort, "kontaktName"
          from public."Company" where id = ${invoice.company_id} limit 1`
      )[0]
    : null;

  // Zahlungskonto aus der hinterlegten Bankverbindung (verbundenes Konto zuerst,
  // sonst ältestes mit IBAN). Fehlt eins, bleibt der Platz leer und der
  // Mitarbeiter ergänzt ihn vor dem Absenden.
  const [bankKonto] = await sql`
    select name, iban from admin.bank_account
    where deleted_at is null and iban is not null
    order by (status = 'VERBUNDEN') desc, created_at asc
    limit 1`;
  const ibanRaw = ((bankKonto?.iban as string | null) ?? "").replace(/\s+/g, "");
  const iban = ibanRaw ? ibanRaw.replace(/(.{4})/g, "$1 ").trim() : null;

  const total = Number(invoice.total_cents ?? 0);
  const stufe = Number(invoice.reminder_count ?? 0) + 1;
  const { titel, gebuehrCents, freundlich } = stufeInfo(stufe);

  const dueAt = invoice.due_at ? new Date(invoice.due_at as string) : null;
  const tageUeberfaellig = dueAt
    ? Math.max(0, Math.floor((Date.now() - dueAt.getTime()) / 86_400_000))
    : 0;
  const zahlungsziel = new Date(Date.now() + 7 * 86_400_000);
  const nummer = invoice.nummer as string;

  const recipientName =
    (company?.name as string | undefined) ??
    (invoice.recipient_name as string | null) ??
    (invoice.company_name as string | null) ??
    "";
  const empfaengerAdresse = company
    ? [
        company.strasse as string | null,
        [company.plz, company.ort].filter(Boolean).join(" ") || null,
        company.kontaktName ? `z. Hd. ${company.kontaktName as string}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : ((invoice.recipient_address as string | null) ?? "");

  const positionen: Position[] = [
    { bezeichnung: `Rechnung ${nummer}`, menge: 1, einzelpreisCents: total },
    ...(gebuehrCents > 0
      ? [{ bezeichnung: "Mahngebühr", menge: 1, einzelpreisCents: gebuehrCents }]
      : []),
  ];

  const einleitung = freundlich
    ? `Sehr geehrte Damen und Herren,\n\nsicher ist es Ihrer Aufmerksamkeit entgangen: unsere Rechnung ${nummer} vom ${formatDate(invoice.issued_at as string)} über ${formatEuroCents(total)} ist noch offen. Wir bitten Sie, den Betrag zeitnah auszugleichen.`
    : `Sehr geehrte Damen und Herren,\n\ntrotz unserer bisherigen Hinweise ist unsere Rechnung ${nummer} vom ${formatDate(invoice.issued_at as string)} über ${formatEuroCents(total)} bis heute nicht beglichen${tageUeberfaellig > 0 ? ` (${tageUeberfaellig} Tage überfällig)` : ""}. Wir fordern Sie auf, den unten genannten Gesamtbetrag zu begleichen.`;

  const werte: FeldWerte = {
    ...SENDER_DEFAULT,
    empfaengerName: recipientName,
    empfaengerAdresse,
    titel,
    nummer: `zu Rechnung ${nummer}`,
    datum: formatDate(new Date()),
    betreff: `${titel} — Rechnung ${nummer}`,
    einleitung,
    schluss: `Bitte überweisen Sie den Gesamtbetrag bis zum ${formatDate(zahlungsziel)} unter Angabe der Rechnungsnummer ${nummer} ${iban ? `auf das Konto ${iban}${bankKonto?.name ? ` (${bankKonto.name as string})` : ""}` : "auf unser Geschäftskonto (Bankverbindung bitte unter Finanzen → Bank hinterlegen)"}.\n\nSollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.\n\nE&H Group · Rieslingstraße 11 · 74360 Ilsfeld-Auenstein · USt-IdNr. DE000000000`,
    steuersatz: "0",
  };

  return (
    <DokumentWerkbank
      felder={RECHNUNG_FELDER}
      initialWerte={werte}
      initialPositionen={positionen}
      mitPositionen
      zurueckHref={`/finanzen/${id}`}
      zurueckLabel="Zurück zur Rechnung"
      hinweis={`Vorschau der Mahnung — passe bei Bedarf alle Felder an und speichere sie als PDF. Erst „Mahnung absenden“ vermerkt sie im System.`}
      aktionen={<MahnungConfirm id={id} />}
    />
  );
}
