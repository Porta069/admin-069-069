/**
 * Einheitliches Dokument-/PDF-Modell. Jedes druckbare Dokument (Rechnung,
 * Mahnung, Anschreiben, AGB-Update …) besteht aus editierbaren Feldern
 * (`FeldWerte`) und optionalen Positionen. Ein einziges `DokumentBlatt` rendert
 * daraus die A4-Vorschau; die `DokumentWerkbank` liefert den Feld-Editor.
 */

export type FeldTyp = "text" | "textarea" | "number";

export interface FeldDef {
  key: string;
  label: string;
  typ: FeldTyp;
  /** Gruppen-Überschrift im Editor (z. B. "Absender", "Empfänger"). */
  gruppe: string;
  hint?: string;
  /** Volle Breite im Editor-Grid. */
  breit?: boolean;
}

export interface Position {
  bezeichnung: string;
  menge: number;
  einzelpreisCents: number;
}

export type FeldWerte = Record<string, string>;

/**
 * Vom `DokumentBlatt` erkannte Feld-Schlüssel (alle optional — leere Felder
 * werden weggelassen). So rendert ein Blatt Rechnung, Mahnung und Brief.
 */
export const DOK_FELDER = {
  absenderName: "absenderName",
  absenderAdresse: "absenderAdresse",
  absenderKontakt: "absenderKontakt",
  absenderFuss: "absenderFuss",
  empfaengerName: "empfaengerName",
  empfaengerAdresse: "empfaengerAdresse",
  titel: "titel",
  nummer: "nummer",
  datum: "datum",
  betreff: "betreff",
  einleitung: "einleitung",
  schluss: "schluss",
  steuersatz: "steuersatz",
} as const;

/** Nettosumme der Positionen in Cent. */
export function nettoCents(positionen: Position[]): number {
  return positionen.reduce(
    (s, p) => s + Math.round((Number(p.menge) || 0) * (Number(p.einzelpreisCents) || 0)),
    0,
  );
}
