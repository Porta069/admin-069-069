"use client";

import { formatEuroCents } from "@/lib/format";
import { nettoCents, type FeldWerte, type Position } from "@/lib/dokumente/typen";

/** Werkpair-Markenfarben. */
const GRUEN = "#115F5B";
const GELB = "#F9AD07";
const GRUEN_TINT = "rgba(17,95,91,0.08)";
const GRUEN_RAND = "rgba(17,95,91,0.22)";

function LogoBadge() {
  return (
    <span
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      className="inline-flex shrink-0 items-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/porta-werk-logo.jpg"
        alt="Werkpair"
        className="h-6 w-auto"
        style={{ display: "block" }}
      />
    </span>
  );
}

/** Farbig hervorgehobener Kernbereich (Code, Button/Link, wichtige Info). */
function Hervorhebung({ text, zentriert }: { text: string; zentriert?: boolean }) {
  const zeilen = text.split("\n").map((z) => z.trim()).filter(Boolean);
  if (zeilen.length === 0) return null;
  const [kopf, ...rest] = zeilen;
  return (
    <div
      className={`${zentriert ? "mx-auto" : ""} mt-6 max-w-md rounded-xl px-6 py-5 ${zentriert ? "text-center" : ""}`}
      style={{ backgroundColor: GRUEN_TINT, border: `1px solid ${GRUEN_RAND}` }}
    >
      <p
        className="font-display text-xl font-bold tracking-wide"
        style={{ color: GRUEN }}
      >
        {kopf}
      </p>
      {rest.length > 0 && (
        <p className="mt-1.5 text-sm break-all text-neutral-500">{rest.join(" ")}</p>
      )}
    </div>
  );
}

/**
 * A4-/E-Mail-Dokument aus Feldwerten + optionalen Positionen. Zwei Layouts:
 * `variante="brief"` (Standard: Rechnung/Mahnung/Schreiben) und
 * `variante="zentriert"` (kurze Aktions-Mail: Logo-Streifen oben, Kernbotschaft
 * mittig, farbige Hervorhebung, Kleingedrucktes unten mittig). Gebrandet,
 * theme-unabhängig, druckecht.
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
  const zentriert = w("variante") === "zentriert";
  const hervorhebung = w("hervorhebung");

  const absAdresse = w("absenderAdresse");
  const empfAdresse = w("empfaengerAdresse");
  const fuss =
    w("absenderFuss") ||
    w("absenderName") ||
    "Werkpair · werkpair.de";

  // ── Zentriertes Aktions-Layout (Transaktions-Mail) ──────────────────────
  if (zentriert) {
    const hz = hervorhebung.split("\n").map((z) => z.trim()).filter(Boolean);
    const istButton = hz.length >= 2;
    return (
      <div
        id="pw-doc-sheet"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
        className="relative mx-auto max-w-2xl overflow-hidden rounded-xl bg-neutral-100 text-neutral-800 shadow-md"
      >
        {/* Kopf-Streifen mit zentriertem Logo */}
        <div
          className="flex items-center justify-center py-8"
          style={{ backgroundColor: GRUEN }}
        >
          <LogoBadge />
        </div>

        <div className="px-4 py-8 sm:px-8">
          {/* Weiße Karte */}
          <div className="mx-auto max-w-lg rounded-lg border border-neutral-200 bg-white px-8 py-10 shadow-sm sm:px-10">
            {w("titel") && (
              <h1 className="text-center font-display text-2xl font-bold tracking-tight text-neutral-900">
                {w("titel")}
              </h1>
            )}
            {w("einleitung") && (
              <p className="mt-6 text-sm leading-relaxed whitespace-pre-line text-neutral-700">
                {w("einleitung")}
              </p>
            )}

            {hervorhebung &&
              (istButton ? (
                <div className="mt-7">
                  <span
                    className="inline-block rounded px-6 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: GRUEN }}
                  >
                    {hz[0]}
                  </span>
                  {hz.length > 1 && (
                    <p className="mt-3 text-xs break-all text-neutral-400">
                      {hz.slice(1).join(" ")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-7 text-center">
                  <span
                    className="inline-block rounded-lg border-2 px-8 py-4 font-display text-3xl font-bold"
                    style={{
                      color: GRUEN,
                      borderColor: GRUEN_RAND,
                      backgroundColor: GRUEN_TINT,
                      letterSpacing: "0.25em",
                    }}
                  >
                    {hz[0]}
                  </span>
                </div>
              ))}

            {w("schluss") && (
              <p className="mt-8 text-sm leading-relaxed whitespace-pre-line text-neutral-600">
                {w("schluss")}
              </p>
            )}
          </div>

          {/* Kleiner, zentrierter Fußtext auf grauem Grund */}
          <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-relaxed whitespace-pre-line text-neutral-500">
            {fuss}
          </p>
        </div>
      </div>
    );
  }

  // ── Standard-Layout (Brief/Rechnung) ────────────────────────────────────
  return (
    <div
      id="pw-doc-sheet"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      className="relative mx-auto max-w-3xl overflow-hidden rounded-xl bg-white text-neutral-800 shadow-md"
    >
      {/* Gebrandeter Kopf mit Logo */}
      <div
        className="relative overflow-hidden px-8 py-7 sm:px-12"
        style={{ backgroundColor: GRUEN }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-12 size-64 rounded-full"
          style={{ backgroundColor: "#ffffff", opacity: 0.06 }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoBadge />
            {(absAdresse || w("absenderKontakt")) && (
              <div>
                {absAdresse && (
                  <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-line text-white/70">
                    {absAdresse}
                  </p>
                )}
                {w("absenderKontakt") && (
                  <p className="text-xs text-white/70">{w("absenderKontakt")}</p>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            {w("titel") && (
              <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                {w("titel")}
              </h1>
            )}
            {w("nummer") && (
              <p className="mt-1 font-mono text-xs text-white/70">{w("nummer")}</p>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: GELB }} />

      {/* Textkörper */}
      <div className="px-8 py-10 sm:px-12">
        <div className="flex flex-wrap justify-between gap-6">
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

        {w("betreff") && (
          <p className="mt-9 text-sm font-semibold text-neutral-900">{w("betreff")}</p>
        )}
        {w("einleitung") && (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-neutral-700">
            {w("einleitung")}
          </p>
        )}

        {hervorhebung && <Hervorhebung text={hervorhebung} />}

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

        {w("schluss") && (
          <div className="mt-8 border-t border-neutral-200 pt-6 text-sm leading-relaxed whitespace-pre-line text-neutral-600">
            {w("schluss")}
          </div>
        )}
      </div>

      {/* Fußzeile */}
      <div className="h-0.5 w-full" style={{ backgroundColor: GRUEN }} />
      <div className="bg-neutral-50 px-8 py-4 sm:px-12">
        <p className="text-xs text-neutral-500">{fuss}</p>
      </div>
    </div>
  );
}
