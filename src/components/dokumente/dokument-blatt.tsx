"use client";

import { Hammer } from "lucide-react";
import { formatEuroCents } from "@/lib/format";
import { nettoCents, type FeldWerte, type Position } from "@/lib/dokumente/typen";

/** PORTAWERK-Markenfarben. */
const GRUEN = "#115F5B";
const GELB = "#F9AD07";

/**
 * Rendert die A4-Dokumentvorschau aus Feldwerten + optionalen Positionen —
 * im Markendesign (grün/gelb), festes „Papier"-Layout (theme-unabhängig) und
 * druckecht (print-color-adjust: exact). Leere Felder werden ausgelassen, sodass
 * dasselbe Blatt Rechnung, Mahnung und jede Benachrichtigung abbildet.
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
      {/* Marken-Kante oben */}
      <div className="h-1.5 w-full" style={{ backgroundColor: GRUEN }} />
      <div className="h-0.5 w-full" style={{ backgroundColor: GELB }} />

      {/* Dezentes Hintergrund-Dekor */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-24 size-72 rounded-full"
        style={{ backgroundColor: GRUEN, opacity: 0.05 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full"
        style={{ backgroundColor: GELB, opacity: 0.07 }}
      />

      <div className="relative p-8 sm:p-10">
        {/* Kopf */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: GRUEN }}
            >
              <Hammer className="size-5" style={{ color: GELB }} />
            </span>
            <div>
              {w("absenderName") && (
                <p
                  className="font-display text-lg font-bold tracking-tight"
                  style={{ color: GRUEN }}
                >
                  {w("absenderName")}
                </p>
              )}
              {absAdresse && (
                <p className="mt-1 text-sm whitespace-pre-line text-neutral-500">
                  {absAdresse}
                </p>
              )}
              {w("absenderKontakt") && (
                <p className="mt-0.5 text-sm text-neutral-500">{w("absenderKontakt")}</p>
              )}
            </div>
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
            <div
              className="mt-2 ml-auto h-1 w-14 rounded-full"
              style={{ backgroundColor: GELB }}
            />
          </div>
        </div>

        {/* Empfänger + Datum */}
        <div className="mt-10 flex flex-wrap justify-between gap-6">
          <div className="min-w-56">
            {w("empfaengerName") && (
              <>
                <p
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: GRUEN }}
                >
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
            <div className="text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-neutral-500">Datum</dt>
                <dd className="tabular text-neutral-800">{w("datum")}</dd>
              </div>
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
              <tr
                className="text-left"
                style={{ backgroundColor: "rgba(17,95,91,0.07)", color: GRUEN }}
              >
                <th className="rounded-l-md px-3 py-2 font-semibold">Position</th>
                <th className="px-3 py-2 text-right font-semibold">Menge</th>
                <th className="px-3 py-2 text-right font-semibold">Einzelpreis</th>
                <th className="rounded-r-md px-3 py-2 text-right font-semibold">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {positionen!.map((p, i) => {
                const betrag = Math.round((Number(p.menge) || 0) * (Number(p.einzelpreisCents) || 0));
                return (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="px-3 py-2.5 text-neutral-800">{p.bezeichnung || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular text-neutral-600">{p.menge}</td>
                    <td className="px-3 py-2.5 text-right tabular text-neutral-600">
                      {formatEuroCents(Number(p.einzelpreisCents) || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-neutral-800">
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
                    <td colSpan={3} className="px-3 pt-3 text-right text-neutral-500">
                      Zwischensumme (netto)
                    </td>
                    <td className="px-3 pt-3 text-right tabular text-neutral-700">
                      {formatEuroCents(netto)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 pt-1 text-right text-neutral-500">
                      zzgl. {steuersatz}% USt
                    </td>
                    <td className="px-3 pt-1 text-right tabular text-neutral-700">
                      {formatEuroCents(steuer)}
                    </td>
                  </tr>
                </>
              )}
              <tr>
                <td colSpan={3} className="px-3 pt-3 text-right font-semibold text-neutral-700">
                  Gesamtbetrag
                </td>
                <td className="px-3 pt-3 text-right">
                  <span
                    className="inline-block font-display text-lg font-bold tabular"
                    style={{ color: GRUEN, borderBottom: `2px solid ${GELB}` }}
                  >
                    {formatEuroCents(gesamt)}
                  </span>
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

      {/* Marken-Fußkante */}
      <div className="h-1 w-full" style={{ backgroundColor: GRUEN }} />
    </div>
  );
}
