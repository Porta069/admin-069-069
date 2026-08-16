import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/common/status-badge";
import { DokumentWerkbank } from "@/components/dokumente/dokument-werkbank";
import { SENDER_DEFAULT, RECHNUNG_FELDER } from "@/lib/dokumente/felder";
import type { FeldWerte, Position } from "@/lib/dokumente/typen";
import { INVOICE_STATUS, INVOICE_ART, type RechnungsPosition } from "../_components/status";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEmployee("rewards");
  const { id } = await params;

  const [invoice] = await sql`
    select i.*, pl.candidate_name, pl.job_title
    from admin.invoice i
    left join admin.placement pl on pl.id = i.placement_id
    where i.id = ${id} and i.deleted_at is null
    limit 1`;
  if (!invoice) notFound();

  const company = invoice.company_id
    ? (
        await sql`
          select name, strasse, plz, ort, "kontaktName"
          from public."Company" where id = ${invoice.company_id} limit 1`
      )[0]
    : null;

  const baseFee = Number(invoice.base_fee_cents ?? 0);
  const commission = Number(invoice.commission_cents ?? 0);
  const total = Number(invoice.total_cents ?? 0);
  const artKey = (invoice.art as string) ?? "VERMITTLUNG";
  const belegTitel = artKey === "REFERRAL" ? "Empfehlungsabrechnung" : "Rechnung";
  const isPaid = invoice.status === "BEZAHLT";
  const isCancelled = invoice.status === "STORNIERT";

  // Positionen: gespeicherte jsonb oder aus Grundgebühr/Provision ableiten.
  const rohPositionen = (
    Array.isArray(invoice.positionen) ? invoice.positionen : []
  ) as RechnungsPosition[];
  const positionen: Position[] =
    rohPositionen.length > 0
      ? rohPositionen.map((p) => ({
          bezeichnung: p.bezeichnung,
          menge: Number(p.menge ?? 1),
          einzelpreisCents: Number(p.einzelpreis_cents ?? 0),
        }))
      : [
          { bezeichnung: "Vermittlungspauschale (Grundgebühr)", menge: 1, einzelpreisCents: baseFee },
          ...(commission > 0
            ? [{ bezeichnung: "Erfolgsprovision", menge: 1, einzelpreisCents: commission }]
            : []),
        ];

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

  const nummer = invoice.nummer as string;
  const faellig = formatDate(invoice.due_at as string | null);
  const schluss = isCancelled
    ? "Diese Rechnung wurde storniert."
    : isPaid
      ? `Bezahlt am ${formatDate(invoice.paid_at as string)}. Vielen Dank.`
      : `Bitte überweisen Sie den Gesamtbetrag bis zum ${faellig} unter Angabe der Rechnungsnummer ${nummer}.`;

  const werte: FeldWerte = {
    ...SENDER_DEFAULT,
    empfaengerName: recipientName,
    empfaengerAdresse,
    titel: belegTitel,
    nummer,
    datum: formatDate(invoice.issued_at as string),
    betreff: `${belegTitel} ${nummer}`,
    einleitung: "Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:",
    schluss: `${schluss}\n\nE&H Group · Rieslingstraße 11 · 74360 Ilsfeld-Auenstein · USt-IdNr. DE000000000`,
    steuersatz: String(Number(invoice.tax_rate ?? 0)),
  };

  return (
    <DokumentWerkbank
      felder={RECHNUNG_FELDER}
      initialWerte={werte}
      initialPositionen={positionen}
      mitPositionen
      zurueckHref="/finanzen"
      zurueckLabel="Zurück zu Finanzen"
      hinweis={`Gesamtbetrag laut System: ${total >= 0 ? "" : ""}${(total / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}. Du kannst alle Felder vor dem Druck anpassen — Änderungen wirken nur auf dieses PDF, nicht auf die gespeicherte Rechnung.`}
      aktionen={
        <div className="flex items-center gap-2">
          <StatusBadge map={INVOICE_ART} value={artKey} withDot={false} />
          <StatusBadge map={INVOICE_STATUS} value={invoice.status as string} />
        </div>
      }
    />
  );
}
