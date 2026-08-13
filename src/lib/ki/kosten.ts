import type { ModellStufe } from "@/lib/ki";

/**
 * Sehr kleine, unaufdringliche KI-Kostenanzeige pro Funktion. Rechnet aus einer
 * groben, festen Token-Schätzung die erwarteten Kosten und formatiert sie
 * kompakt auf Deutsch. Reine Zahlenlogik ohne Server-Abhängigkeit — damit auch
 * in Client-Komponenten neben den KI-Buttons nutzbar (kein "server-only").
 */

/** Modellpreise in USD pro 1 Mio. Tokens (Stand: Preisliste). */
export const MODELL_PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
  "claude-sonnet-5": { in: 3.0, out: 15.0 },
  "claude-opus-5": { in: 5.0, out: 25.0 },
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
};

/** USD → EUR, ca. (bewusst als Konstante gepflegt, keine Live-Kurse). */
const USD_ZU_EUR = 0.92;

/**
 * Stufe → Modell, gespiegelt aus MODELLE in "@/lib/ki". Bewusst dupliziert,
 * damit diese Datei ohne den server-only-Import der KI-Basis auskommt.
 */
const STUFE_MODELL: Record<ModellStufe, string> = {
  guenstig: "claude-haiku-4-5",
  standard: "claude-sonnet-5",
  premium: "claude-opus-5",
};

/** Rohschätzung: erwartete Tokens gesamt + Kosten in EUR. */
export function schaetzeKosten(
  stufe: ModellStufe,
  inTokens: number,
  outTokens: number,
): { tokens: number; euro: number } {
  const preis = MODELL_PREISE[STUFE_MODELL[stufe]] ?? MODELL_PREISE["claude-haiku-4-5"];
  const usd = (inTokens / 1_000_000) * preis.in + (outTokens / 1_000_000) * preis.out;
  return { tokens: inTokens + outTokens, euro: usd * USD_ZU_EUR };
}

function formatTokens(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}k`;
  }
  return String(Math.round(n));
}

function formatEuro(euro: number): string {
  if (euro > 0 && euro < 0.001) return "<0,001 €";
  return `${euro.toLocaleString("de-DE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} €`;
}

/** Kompaktes Label, z. B. "~770 Tokens · ~0,002 €". */
export function formatKosten(
  stufe: ModellStufe,
  inTokens: number,
  outTokens: number,
): string {
  const { tokens, euro } = schaetzeKosten(stufe, inTokens, outTokens);
  return `~${formatTokens(tokens)} Tokens · ~${formatEuro(euro)}`;
}

/**
 * Feste, realistische Schätzwerte je KI-Funktion (grobe Erwartung des
 * Verbrauchs pro Klick). Zentral gepflegt, damit UI-Labels konsistent bleiben.
 */
export const KI_SCHAETZUNG: Record<string, { stufe: ModellStufe; in: number; out: number }> = {
  zusammenfassung: { stufe: "guenstig", in: 550, out: 220 },
  pitch: { stufe: "guenstig", in: 500, out: 220 },
  ergebnis: { stufe: "standard", in: 750, out: 380 },
  fragen: { stufe: "guenstig", in: 450, out: 180 },
};

/** Fertiges Kostenlabel für eine bekannte Funktion (leer, wenn unbekannt). */
export function kostenLabelFuer(key: keyof typeof KI_SCHAETZUNG | string): string {
  const s = KI_SCHAETZUNG[key];
  return s ? formatKosten(s.stufe, s.in, s.out) : "";
}
