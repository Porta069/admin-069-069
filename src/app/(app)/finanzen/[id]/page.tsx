import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  INVOICE_STATUS,
  INVOICE_ART,
  type RechnungsPosition,
} from "../_components/status";
import { PrintButton } from "../_components/print-button";

/** Absenderdaten PORTAWERK (Rechnungssteller). */
const SENDER = {
  name: "PORTAWERK GmbH",
  strasse: "Handwerkstraße 1",
  plz: "10115",
  ort: "Berlin",
  email: "rechnung@portawerk.de",
  ustId: "DE000000000",
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #pw-invoice-sheet, #pw-invoice-sheet * { visibility: visible !important; }
  #pw-invoice-sheet {
    position: absolute; left: 0; top: 0; width: 100%;
    border: none !important; box-shadow: none !important; margin: 0 !important;
  }
  @page { margin: 18mm; size: A4; }
}
`;

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
          select name, strasse, plz, ort, "kontaktName", "kontaktEmail"
          from public."Company" where id = ${invoice.company_id} limit 1`
      )[0]
    : null;

  const baseFee = Number(invoice.base_fee_cents ?? 0);
  const commission = Number(invoice.commission_cents ?? 0);
  const total = Number(invoice.total_cents ?? 0);
  const isPaid = invoice.status === "BEZAHLT";
  const isCancelled = invoice.status === "STORNIERT";

  const positionen = (
    Array.isArray(invoice.positionen) ? invoice.positionen : []
  ) as RechnungsPosition[];
  const hatPositionen = positionen.length > 0;
  const netto = hatPositionen
    ? positionen.reduce((s, p) => s + Number(p.betrag_cents ?? 0), 0)
    : baseFee + commission;
  const taxRate = Number(invoice.tax_rate ?? 0);
  const steuer = Math.round((netto * taxRate) / 100);
  const artKey = (invoice.art as string) ?? "VERMITTLUNG";
  const artLabel = INVOICE_ART[artKey]?.label ?? "Rechnung";
  const belegTitel = artKey === "REFERRAL" ? "Empfehlungsabrechnung" : "Rechnung";

  const recipientName =
    (company?.name as string | undefined) ??
    (invoice.recipient_name as string | null) ??
    (invoice.company_name as string | null) ??
    "—";

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="mb-5 flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/finanzen">
            <ArrowLeft className="size-4" />
            Zurück zu Finanzen
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge map={INVOICE_STATUS} value={invoice.status as string} />
          <PrintButton />
        </div>
      </div>

      <div
        id="pw-invoice-sheet"
        className="mx-auto max-w-3xl rounded-lg border bg-card p-8 sm:p-10"
      >
        {/* Kopf */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-xl font-semibold tracking-tight">
              {SENDER.name}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {SENDER.strasse}
              <br />
              {SENDER.plz} {SENDER.ort}
              <br />
              {SENDER.email}
            </p>
          </div>
          <div className="text-right">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {belegTitel}
            </h1>
            <p className="mt-1 font-mono text-sm">{invoice.nummer as string}</p>
            <p className="mt-1 text-xs text-muted-foreground">{artLabel}</p>
          </div>
        </div>

        {/* Empfänger + Meta */}
        <div className="mt-10 flex flex-wrap justify-between gap-6">
          <div className="min-w-56">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Rechnungsempfänger
            </p>
            <p className="mt-2 font-medium">{recipientName}</p>
            {company && (
              <p className="mt-1 text-sm text-muted-foreground">
                {(company.strasse as string | null) && (
                  <>
                    {company.strasse as string}
                    <br />
                  </>
                )}
                {[company.plz, company.ort]
                  .filter(Boolean)
                  .join(" ") || null}
                {(company.kontaktName as string | null) && (
                  <>
                    <br />
                    z. Hd. {company.kontaktName as string}
                  </>
                )}
              </p>
            )}
            {!company && (invoice.recipient_address as string | null) && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                {invoice.recipient_address as string}
              </p>
            )}
          </div>
          <div className="text-sm">
            <dl className="space-y-1">
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Rechnungsdatum</dt>
                <dd className="tabular">
                  {formatDate(invoice.issued_at as string)}
                </dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Fällig am</dt>
                <dd className="tabular">
                  {formatDate(invoice.due_at as string | null)}
                </dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Rechnungsnr.</dt>
                <dd className="font-mono">{invoice.nummer as string}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Positionen */}
        <table className="mt-10 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Position</th>
              <th className="pb-2 text-right font-medium">Menge</th>
              <th className="pb-2 text-right font-medium">Einzelpreis</th>
              <th className="pb-2 text-right font-medium">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {hatPositionen ? (
              positionen.map((p, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3">
                    {p.bezeichnung}
                    {i === 0 && invoice.candidate_name && (
                      <span className="block text-xs text-muted-foreground">
                        Kandidat: {invoice.candidate_name as string}
                        {invoice.job_title
                          ? ` — ${invoice.job_title as string}`
                          : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right tabular">{p.menge}</td>
                  <td className="py-3 text-right tabular">
                    {formatEuroCents(Number(p.einzelpreis_cents ?? 0))}
                  </td>
                  <td className="py-3 text-right tabular">
                    {formatEuroCents(Number(p.betrag_cents ?? 0))}
                  </td>
                </tr>
              ))
            ) : (
              <>
                <tr className="border-b">
                  <td className="py-3">
                    Vermittlungspauschale (Grundgebühr)
                    {invoice.candidate_name && (
                      <span className="block text-xs text-muted-foreground">
                        Kandidat: {invoice.candidate_name as string}
                        {invoice.job_title
                          ? ` — ${invoice.job_title as string}`
                          : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right tabular">1</td>
                  <td className="py-3 text-right tabular">
                    {formatEuroCents(baseFee)}
                  </td>
                  <td className="py-3 text-right tabular">
                    {formatEuroCents(baseFee)}
                  </td>
                </tr>
                {commission > 0 && (
                  <tr className="border-b">
                    <td className="py-3">Erfolgsprovision</td>
                    <td className="py-3 text-right tabular">1</td>
                    <td className="py-3 text-right tabular">
                      {formatEuroCents(commission)}
                    </td>
                    <td className="py-3 text-right tabular">
                      {formatEuroCents(commission)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          <tfoot>
            {taxRate > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="pt-4 text-right text-muted-foreground">
                    Zwischensumme (netto)
                  </td>
                  <td className="pt-4 text-right tabular">
                    {formatEuroCents(netto)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-muted-foreground">
                    zzgl. {taxRate}% USt
                  </td>
                  <td className="pt-1 text-right tabular">
                    {formatEuroCents(steuer)}
                  </td>
                </tr>
              </>
            )}
            <tr>
              <td colSpan={3} className="pt-4 text-right font-medium">
                Gesamtbetrag
              </td>
              <td className="pt-4 text-right font-display text-lg font-semibold tabular">
                {formatEuroCents(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {(invoice.notes as string | null) && (
          <div className="mt-6 text-sm text-muted-foreground">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Hinweise
            </p>
            <p className="mt-1 whitespace-pre-line">{invoice.notes as string}</p>
          </div>
        )}

        {/* Hinweise */}
        <div className="mt-10 space-y-2 border-t pt-6 text-sm text-muted-foreground">
          {isCancelled ? (
            <p className="font-medium text-destructive">
              Diese Rechnung wurde storniert.
            </p>
          ) : isPaid ? (
            <p className="font-medium text-success">
              Bezahlt am {formatDate(invoice.paid_at as string)}. Vielen Dank.
            </p>
          ) : (
            <p>
              Bitte überweisen Sie den Gesamtbetrag bis zum{" "}
              <span className="tabular">
                {formatDate(invoice.due_at as string | null)}
              </span>{" "}
              unter Angabe der Rechnungsnummer {invoice.nummer as string}.
            </p>
          )}
          <p className="text-xs">
            {SENDER.name} · USt-IdNr. {SENDER.ustId}
          </p>
        </div>
      </div>
    </>
  );
}
