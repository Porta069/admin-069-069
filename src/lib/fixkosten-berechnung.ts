/**
 * Umrechnung von Fixkosten/Einmalzahlungen auf „pro Monat" und „pro Jahr".
 * Isomorph (kein server-only) — wird von der Seite (Summen) und vom Dialog
 * (Live-Vorschau) genutzt, damit die Rechnung überall identisch ist.
 *
 *  - LAUFEND monatlich: /Monat = Betrag,      /Jahr = Betrag × 12
 *  - LAUFEND jährlich:  /Monat = Betrag ÷ 12, /Jahr = Betrag
 *  - EINMALIG:          /Jahr  = Betrag,       /Monat = Betrag ÷ 12 (anteilig)
 */

export type FixKind = "LAUFEND" | "EINMALIG";
export type FixIntervall = "MONTHLY" | "YEARLY";

export interface FixItem {
  kind: FixKind;
  intervall: FixIntervall | null;
  amountCents: number;
}

export const INTERVALL_LABEL: Record<FixIntervall, string> = {
  MONTHLY: "monatlich",
  YEARLY: "jährlich",
};

export const KIND_LABEL: Record<FixKind, string> = {
  LAUFEND: "Laufend",
  EINMALIG: "Einmalzahlung",
};

export function proMonatCents(i: FixItem): number {
  const a = i.amountCents || 0;
  if (i.kind === "EINMALIG") return Math.round(a / 12);
  if (i.intervall === "YEARLY") return Math.round(a / 12);
  return a; // LAUFEND monatlich (Standard)
}

export function proJahrCents(i: FixItem): number {
  const a = i.amountCents || 0;
  if (i.kind === "EINMALIG") return a;
  if (i.intervall === "YEARLY") return a;
  return a * 12; // LAUFEND monatlich
}

export interface FixSummen {
  laufendProMonat: number;
  laufendProJahr: number;
  einmaligGesamt: number;
  einmaligProMonat: number;
  gesamtProMonat: number;
  gesamtProJahr: number;
}

export function summiere(items: FixItem[]): FixSummen {
  let laufendProMonat = 0;
  let laufendProJahr = 0;
  let einmaligGesamt = 0;
  for (const i of items) {
    if (i.kind === "EINMALIG") {
      einmaligGesamt += i.amountCents || 0;
    } else {
      laufendProMonat += proMonatCents(i);
      laufendProJahr += proJahrCents(i);
    }
  }
  const einmaligProMonat = Math.round(einmaligGesamt / 12);
  return {
    laufendProMonat,
    laufendProJahr,
    einmaligGesamt,
    einmaligProMonat,
    gesamtProMonat: laufendProMonat + einmaligProMonat,
    gesamtProJahr: laufendProJahr + einmaligGesamt,
  };
}
