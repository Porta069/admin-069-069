"use client";

import { formatEuroCents } from "@/lib/format";
import { nettoCents, type FeldWerte, type Position } from "@/lib/dokumente/typen";

/** PORTAWERK-Markenfarben. */
const GRUEN = "#115F5B";
const GELB = "#F9AD07";

/**
 * A4-Dokumentvorschau aus Feldwerten + optionalen Positionen. Ruhiges, festes
 * „Papier"-Layout (theme-unabhängig, druckecht) mit nur vier dezenten
 * Marken-Formen im Hintergrund. Ein Blatt für Rechnung, Mahnung und jede
 * Benachrichtigung.
 */
export function DokumentBlatt({
  werte,
  positionen,
}: {
  werte: FeldWerte;
  positionen?: Position[];
}) {
  const w = (k: string) => (werte[k] ?? "").trim();
  const hatPositionen = Array.isArray(positionen) && positionen.length > 0;
  const netto = hatPositionen ? nettoCents(positionen!) : 0;
  const steuersatz = Math.min(100, Math.max(0, Math.round(Number(w("steuersatz")) || 0)));
  const steuer = Math.round((netto * steuersatz) / 100);
  const gesamt = netto + steuer;

  const absAdresse = w("absenderAdresse");
  const empfAdresse = w("empfaengerAdresse");

  return (
    <div
      id="pw-doc-sheet"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      className="relative mx-auto max-w-3xl overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-sm"
    >
      {/* Vier abstrakte Marken-Formen */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full"
        style={{ backgroundColor: GRUEN, opacity: 0.16 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full"
        style={{ backgroundColor: GELB, opacity: 0.2 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -left-12 size-28 rotate-12 rounded-2xl"
        style={{ backgroundColor: GRUEN, opacity: 0.14 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 bottom-24 size-20 rounded-full border-[6px]"
        style={{ borderColor: GELB, opacity: 0.55 }}
      />

      <div className="relative p-8 sm:p-12">
        {/* Kopf */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {w("absenderName") && (
              <p className="font-display text-lg font-semibold tracking-tight text-neutral-900">
                {w("absenderName")}
              </p>
            )}
            {absAdresse && (
              <p className="mt-1.5 text-sm whitespace-pre-line text-neutral-500">
                {absAdresse}
              </p>
            )}
            {w("absenderKontakt") && (
              <p className="mt-0.5 text-sm text-neutral-500">{w("absenderKontakt")}</p>
            )}
          </div>
          <div className="text-right">
            {w("titel") && (
              <h1
                className="font-display text-2xl font-bold tracking-tight"
                style={{ color: GRUEN }}
              >
                {w("titel")}
              </h1>
            )}
            {w("nummer") && (
              <p className="mt-1 font-mono text-sm text-neutral-500">{w("nummer")}</p>
            )}
          </div>
        </div>

        {/* Empfänger + Datum */}
        <div className="mt-12 flex flex-wrap justify-between gap-6">
          <div className="min-w-56">
            {w("empfaengerName") && (
              <>
                <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  An
                </p>
                <p className="mt-2 font-medium text-neutral-900">{w("empfaengerName")}</p>
              </>
            )}
            {empfAdresse && (
              <p className="mt-1 text-sm whitespace-pre-line text-neutral-500">
                {empfAdresse}
              </p>
            )}
          </div>
          {w("datum") && (
            <div className="flex gap-8 text-sm">
              <dt className="text-neutral-400">Datum</dt>
              <dd className="tabular text-neutral-700">{w("datum")}</dd>
            </div>
          )}
        </div>

        {/* Betreff + Text */}
        {w("betreff") && (
          <p className="mt-10 text-sm font-semibold text-neutral-900">{w("betreff")}</p>
        )}
        {w("einleitung") && (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-neutral-700">
            {w("einleitung")}
          </p>
        )}

        {/* Positionen */}
        {hatPositionen && (
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-400">
                <th className="pb-2 font-medium">Position</th>
                <th className="pb-2 text-right font-medium">Menge</th>
                <th className="pb-2 text-right font-medium">Einzelpreis</th>
                <th className="pb-2 text-right font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {positionen!.map((p, i) => {
                const betrag = Math.round((Number(p.menge) || 0) * (Number(p.einzelpreisCents) || 0));
                return (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2.5 text-neutral-800">{p.bezeichnung || "—"}</td>
                    <td className="py-2.5 text-right tabular text-neutral-600">{p.menge}</td>
                    <td className="py-2.5 text-right tabular text-neutral-600">
                      {formatEuroCents(Number(p.einzelpreisCents) || 0)}
                    </td>
                    <td className="py-2.5 text-right tabular text-neutral-800">
                      {formatEuroCents(betrag)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {steuersatz > 0 && (
                <>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right text-neutral-500">
                      Zwischensumme (netto)
                    </td>
                    <td className="pt-3 text-right tabular text-neutral-700">
                      {formatEuroCents(netto)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-1 text-right text-neutral-500">
                      zzgl. {steuersatz}% USt
                    </td>
                    <td className="pt-1 text-right tabular text-neutral-700">
                      {formatEuroCents(steuer)}
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={3} className="pt-3 text-right font-semibold text-neutral-700">
                  Gesamtbetrag
                </td>
                <td
                  className="pt-3 text-right font-display text-lg font-bold tabular"
                  style={{ color: GRUEN }}
                >
                  {formatEuroCents(gesamt)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Schluss / Hinweise */}
        {w("schluss") && (
          <div className="mt-8 border-t border-neutral-200 pt-6 text-sm leading-relaxed whitespace-pre-line text-neutral-600">
            {w("schluss")}
          </div>
        )}
        {w("absenderFuss") && (
          <p className="mt-6 text-xs text-neutral-400">{w("absenderFuss")}</p>
        )}
      </div>
    </div>
  );
}
