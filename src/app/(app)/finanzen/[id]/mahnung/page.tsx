import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PrintButton } from "../../_components/print-button";
import { MahnungConfirm } from "../../_components/mahnung-confirm";

/** Absenderdaten PORTAWERK (identisch zur Rechnung). */
const SENDER = {
  name: "PORTAWERK GmbH",
  strasse: "Handwerkstraße 1",
  plz: "10115",
  ort: "Berlin",
  email: "rechnung@portawerk.de",
  ustId: "DE000000000",
  iban: "DE00 0000 0000 0000 0000 00",
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #pw-mahnung-sheet, #pw-mahnung-sheet * { visibility: visible !important; }
  #pw-mahnung-sheet {
    position: absolute; left: 0; top: 0; width: 100%;
    border: none !important; box-shadow: none !important; margin: 0 !important;
  }
  @page { margin: 18mm; size: A4; }
}
`;

/** Mahnstufe (1 = Zahlungserinnerung) → Titel + Mahngebühr + Ton. */
function stufeInfo(stufe: number) {
  if (stufe <= 1)
    return { titel: "Zahlungserinnerung", gebuehrCents: 0, freundlich: true };
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

  // Mahnungen nur für offene/überfällige Rechnungen.
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

  const total = Number(invoice.total_cents ?? 0);
  const stufe = Number(invoice.reminder_count ?? 0) + 1;
  const { titel, gebuehrCents, freundlich } = stufeInfo(stufe);
  const gesamt = total + gebuehrCents;

  const dueAt = invoice.due_at ? new Date(invoice.due_at as string) : null;
  const tageUeberfaellig = dueAt
    ? Math.max(0, Math.floor((Date.now() - dueAt.getTime()) / 86_400_000))
    : 0;
  const zahlungsziel = new Date(Date.now() + 7 * 86_400_000);

  const recipientName =
    (company?.name as string | undefined) ??
    (invoice.recipient_name as string | null) ??
    (invoice.company_name as string | null) ??
    "—";

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={`/finanzen/${id}`}>
            <ArrowLeft className="size-4" />
            Zurück zur Rechnung
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <PrintButton />
          <MahnungConfirm id={id} />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info print:hidden">
        Vorschau der {titel} zu Rechnung {invoice.nummer as string}. Prüfe die
        Angaben, speichere sie bei Bedarf als PDF und entscheide dann „absenden"
        oder „nicht absenden". Erst beim Absenden wird die Mahnung im System
        vermerkt.
      </div>

      <div
        id="pw-mahnung-sheet"
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
              {titel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              zu Rechnung{" "}
              <span className="font-mono">{invoice.nummer as string}</span>
            </p>
          </div>
        </div>

        {/* Empfänger + Meta */}
        <div className="mt-10 flex flex-wrap justify-between gap-6">
          <div className="min-w-56">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              An
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
                {[company.plz, company.ort].filter(Boolean).join(" ") || null}
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
                <dt className="text-muted-foreground">Datum</dt>
                <dd className="tabular">{formatDate(new Date())}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Rechnungsdatum</dt>
                <dd className="tabular">{formatDate(invoice.issued_at as string)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Fällig war</dt>
                <dd className="tabular">
                  {formatDate(invoice.due_at as string | null)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Anschreiben */}
        <div className="mt-10 space-y-3 text-sm leading-relaxed">
          <p className="font-medium">
            {freundlich
              ? "Zahlungserinnerung"
              : titel + " — Bitte begleichen Sie den offenen Betrag"}
          </p>
          <p>
            Sehr geehrte Damen und Herren,
          </p>
          <p>
            {freundlich ? (
              <>
                sicher ist es Ihrer Aufmerksamkeit entgangen: unsere Rechnung{" "}
                <span className="font-mono">{invoice.nummer as string}</span> vom{" "}
                {formatDate(invoice.issued_at as string)} über{" "}
                <span className="font-medium">{formatEuroCents(total)}</span> ist
                noch offen. Wir bitten Sie, den Betrag zeitnah auszugleichen.
              </>
            ) : (
              <>
                trotz unserer bisherigen Hinweise ist unsere Rechnung{" "}
                <span className="font-mono">{invoice.nummer as string}</span> vom{" "}
                {formatDate(invoice.issued_at as string)} über{" "}
                <span className="font-medium">{formatEuroCents(total)}</span> bis
                heute nicht beglichen
                {tageUeberfaellig > 0
                  ? ` (${tageUeberfaellig} Tage überfällig)`
                  : ""}
                . Wir fordern Sie auf, den unten genannten Gesamtbetrag zu
                begleichen.
              </>
            )}
          </p>
        </div>

        {/* Forderungsaufstellung */}
        <table className="mt-8 w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2">
                Rechnung {invoice.nummer as string}
                {invoice.candidate_name ? (
                  <span className="block text-xs text-muted-foreground">
                    {invoice.candidate_name as string}
                    {invoice.job_title ? ` — ${invoice.job_title as string}` : ""}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-right tabular">{formatEuroCents(total)}</td>
            </tr>
            {gebuehrCents > 0 && (
              <tr className="border-b">
                <td className="py-2">Mahngebühr</td>
                <td className="py-2 text-right tabular">
                  {formatEuroCents(gebuehrCents)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-right font-medium">Gesamtforderung</td>
              <td className="pt-3 text-right font-display text-lg font-semibold tabular">
                {formatEuroCents(gesamt)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Zahlungshinweis */}
        <div className="mt-8 space-y-2 border-t pt-6 text-sm text-muted-foreground">
          <p>
            Bitte überweisen Sie den Gesamtbetrag bis zum{" "}
            <span className="font-medium text-foreground tabular">
              {formatDate(zahlungsziel)}
            </span>{" "}
            unter Angabe der Rechnungsnummer {invoice.nummer as string} auf das
            Konto {SENDER.iban}.
          </p>
          <p>
            Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben,
            betrachten Sie es bitte als gegenstandslos.
          </p>
          <p className="text-xs">
            {SENDER.name} · USt-IdNr. {SENDER.ustId}
          </p>
        </div>
      </div>
    </>
  );
}
