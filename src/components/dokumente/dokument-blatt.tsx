"use client";

import { formatEuroCents } from "@/lib/format";
import { nettoCents, type FeldWerte, type Position } from "@/lib/dokumente/typen";

/**
 * Rendert die A4-Dokumentvorschau aus Feldwerten + optionalen Positionen.
 * Rein darstellend — leere Felder werden ausgelassen, sodass dasselbe Blatt
 * Rechnung, Mahnung und Anschreiben abbildet.
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
      className="mx-auto max-w-3xl rounded-lg border bg-card p-8 text-card-foreground sm:p-10"
    >
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          {w("absenderName") && (
            <p className="font-display text-xl font-semibold tracking-tight">
              {w("absenderName")}
            </p>
          )}
          {absAdresse && (
            <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
              {absAdresse}
            </p>
          )}
          {w("absenderKontakt") && (
            <p className="mt-1 text-sm text-muted-foreground">{w("absenderKontakt")}</p>
          )}
        </div>
        <div className="text-right">
          {w("titel") && (
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {w("titel")}
            </h1>
          )}
          {w("nummer") && (
            <p className="mt-1 font-mono text-sm">{w("nummer")}</p>
          )}
        </div>
      </div>

      {/* Empfänger + Datum */}
      <div className="mt-10 flex flex-wrap justify-between gap-6">
        <div className="min-w-56">
          {w("empfaengerName") && (
            <>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                An
              </p>
              <p className="mt-2 font-medium">{w("empfaengerName")}</p>
            </>
          )}
          {empfAdresse && (
            <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
              {empfAdresse}
            </p>
          )}
        </div>
        {w("datum") && (
          <div className="text-sm">
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Datum</dt>
              <dd className="tabular">{w("datum")}</dd>
            </div>
          </div>
        )}
      </div>

      {/* Betreff + Text */}
      {w("betreff") && <p className="mt-10 text-sm font-medium">{w("betreff")}</p>}
      {w("einleitung") && (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
          {w("einleitung")}
        </p>
      )}

      {/* Positionen */}
      {hatPositionen && (
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
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
                <tr key={i} className="border-b">
                  <td className="py-2">{p.bezeichnung || "—"}</td>
                  <td className="py-2 text-right tabular">{p.menge}</td>
                  <td className="py-2 text-right tabular">
                    {formatEuroCents(Number(p.einzelpreisCents) || 0)}
                  </td>
                  <td className="py-2 text-right tabular">{formatEuroCents(betrag)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {steuersatz > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="pt-3 text-right text-muted-foreground">
                    Zwischensumme (netto)
                  </td>
                  <td className="pt-3 text-right tabular">{formatEuroCents(netto)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-muted-foreground">
                    zzgl. {steuersatz}% USt
                  </td>
                  <td className="pt-1 text-right tabular">{formatEuroCents(steuer)}</td>
                </tr>
              </>
            )}
            <tr>
              <td colSpan={3} className="pt-3 text-right font-medium">
                Gesamtbetrag
              </td>
              <td className="pt-3 text-right font-display text-lg font-semibold tabular">
                {formatEuroCents(gesamt)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Schluss / Hinweise */}
      {w("schluss") && (
        <div className="mt-8 border-t pt-6 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
          {w("schluss")}
        </div>
      )}
      {w("absenderFuss") && (
        <p className="mt-6 text-xs text-muted-foreground">{w("absenderFuss")}</p>
      )}
    </div>
  );
}
