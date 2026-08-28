/**
 * Die Bewertung einer Stelle für einen Handwerker — 1:1 aus dem Backend
 * portiert (src/matching/scoring.ts). Damit rechnet das Dashboard exakt wie die
 * Plattform.
 *
 * Stufe 1 sind Ausschlusskriterien: kein „teilweise". Stufe 2 verteilt Punkte
 * über gewichtete Kriterien; das Ergebnis bestimmt nur die REIHENFOLGE.
 *
 *     Score = 100 × (1 − Σ(Gewicht × (1 − Erfüllung)) / Σ Gewicht)
 *
 * Ein Kriterium, zu dem der Betrieb nichts hinterlegt hat, wird übersprungen
 * statt mit 0 gewertet.
 */

import {
  labelFuer,
  rangAbschluss,
  rangDeutsch,
  rangErfahrung,
  rangFuehrerschein,
  rangMontage,
  rangStart,
  findGewerk,
} from "./catalog";

// ── Profile ─────────────────────────────────────────────────────────────────

/** Die Antworten des Handwerkers aus dem Anmelde-Funnel. */
export interface Kandidatenprofil {
  gewerk: string | null;
  abschluss: string | null;
  /** Freitext, bereits kleingeschrieben und entdoppelt. */
  berufsbezeichnungNorm: string;
  erfahrung: string | null;
  fuehrung: boolean;
  /** Meister-/Technikerqualifikation, falls angegeben. */
  meisterQualifikation: string | null;
  ausbildungsberuf: string | null;
  aufgaben: string[];
  wuensche: string[];
  montage: string | null;
  fuehrerschein: string | null;
  deutsch: string | null;
  start: string | null;
  /** Mindestwunsch in Cent pro Monat; null = übersprungen. */
  gehaltMonatCents: number | null;
}

/** Was ein Inserat sucht. Leere Felder bedeuten: ist dem Betrieb egal. */
export interface Anforderungsprofil {
  gewerke: string[];
  berufe: string[];
  abschlussMin: string | null;
  meisterErwuenscht: boolean;
  aufgaben: string[];
  aufgabenMin: number;
  bezeichnungTags: string[];
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  fuehrungGefordert: boolean;
  montageMin: string | null;
  fuehrerscheinMin: string | null;
  deutschMin: string | null;
  gebotenes: string[];
  startBis: string | null;
  budgetMonatCents: number | null;
  gewichte?: Partial<Record<KriteriumKey, number>>;
}

export interface Lage {
  km: number;
  radiusKm: number;
  ort: string;
  imRadius: boolean;
}

export type KriteriumKey =
  | "aufgaben"
  | "erfahrung"
  | "beruf"
  | "bezeichnung"
  | "gehalt"
  | "wuensche"
  | "fuehrerschein"
  | "meister"
  | "start";

/**
 * Vorgabegewichte. Was jemand tatsächlich gemacht hat, wiegt schwerer als der
 * Titel der Ausbildung, und beides schwerer als der Wunschzettel. Das Gehalt
 * steht bewusst weit oben.
 */
export const STANDARD_GEWICHTE: Record<KriteriumKey, number> = {
  aufgaben: 5,
  erfahrung: 4,
  beruf: 3,
  bezeichnung: 3,
  gehalt: 3,
  wuensche: 2,
  fuehrerschein: 2,
  meister: 2,
  start: 1,
};

const GEHALT_TOLERANZ = 0.9;

// ── Ergebnis ────────────────────────────────────────────────────────────────

export interface KriteriumZeile {
  key: KriteriumKey;
  label: string;
  required: string;
  answer: string;
  weight: number;
  fulfilment: number;
  penalty: number;
  maxPenalty: number;
  skipped: boolean;
  note?: string;
}

export interface Ausschluss {
  key: string;
  label: string;
  reason: string;
}

export interface ScoreAdjustment {
  id: string;
  label: string;
  points: number;
}

export interface MatchBreakdown {
  passed: boolean;
  knockouts: Ausschluss[];
  criteria: KriteriumZeile[];
  totalPenalty: number;
  totalMaxPenalty: number;
  baseScore: number;
  adjustments: ScoreAdjustment[];
  score: number;
  formula: string;
  aiScore: number | null;
}

const FORMEL =
  "Score = 100 × (1 − Σ(Gewicht × (1 − Erfüllung)) / Σ Gewicht). " +
  "Erfüllung ist 1, wenn die Anforderung ganz erfüllt ist, und 0, wenn gar nicht.";

const FORMEL_OHNE =
  "Für diese Stelle sind keine bewertbaren Anforderungen hinterlegt — " +
  "wer die Ausschlusskriterien besteht, passt gleich gut.";

const runde2 = (n: number) => Math.round(n * 100) / 100;

const euro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";

// ── Stufe 1: Ausschluss ─────────────────────────────────────────────────────

export function ausschlusskriterien(
  anf: Anforderungsprofil,
  k: Kandidatenprofil,
  lage?: Lage,
): Ausschluss[] {
  const raus: Ausschluss[] = [];

  if (lage && !lage.imRadius) {
    raus.push({
      key: "entfernung",
      label: "Arbeitsradius",
      reason:
        `${Math.round(lage.km)} km entfernt — außerhalb deines Radius von ` +
        `${lage.radiusKm} km um „${lage.ort}".`,
    });
  }

  if (anf.gewerke.length > 0 && k.gewerk && !anf.gewerke.includes(k.gewerk)) {
    raus.push({
      key: "gewerk",
      label: "Gewerk",
      reason:
        `Gesucht: ${anf.gewerke.map((g) => labelFuer("gewerk", g)).join(" oder ")} — ` +
        `dein Gewerk: ${labelFuer("gewerk", k.gewerk)}.`,
    });
  }

  const abschlussIst = rangAbschluss(k.abschluss);
  const abschlussSoll = rangAbschluss(anf.abschlussMin);
  if (abschlussSoll != null && abschlussIst != null && abschlussIst < abschlussSoll) {
    raus.push({
      key: "abschluss",
      label: "Abschluss",
      reason:
        `Mindestens ${labelFuer("abschluss", anf.abschlussMin!)} verlangt — ` +
        `angegeben: ${labelFuer("abschluss", k.abschluss!)}.`,
    });
  }

  if (anf.aufgaben.length > 0 && anf.aufgabenMin > 0) {
    const treffer = anf.aufgaben.filter((a) => k.aufgaben.includes(a));
    const noetig = Math.min(anf.aufgabenMin, anf.aufgaben.length);
    if (treffer.length < noetig) {
      raus.push({
        key: "aufgaben",
        label: "Aufgabenbereiche",
        reason:
          `Mindestens ${noetig} der gesuchten Bereiche nötig ` +
          `(${anf.aufgaben.map((a) => labelFuer("aufgabe", a)).join(", ")}) — ` +
          `abgedeckt: ${treffer.length}.`,
      });
    }
  }

  if (anf.fuehrungGefordert && !k.fuehrung) {
    raus.push({
      key: "fuehrung",
      label: "Führungsverantwortung",
      reason:
        "Die Stelle setzt Führungserfahrung voraus — im Profil ist keine angegeben.",
    });
  }

  const montageIst = rangMontage(k.montage);
  const montageSoll = rangMontage(anf.montageMin);
  if (montageSoll != null && montageIst != null && montageIst < montageSoll) {
    raus.push({
      key: "montage",
      label: "Montagebereitschaft",
      reason:
        `Die Stelle verlangt „${labelFuer("montage", anf.montageMin!)}" — ` +
        `du hast „${labelFuer("montage", k.montage!)}" angegeben.`,
    });
  }

  const fsIst = rangFuehrerschein(k.fuehrerschein);
  const fsSoll = rangFuehrerschein(anf.fuehrerscheinMin);
  if (fsSoll != null && fsSoll > 0 && fsIst === 0) {
    raus.push({
      key: "fuehrerschein",
      label: "Führerschein",
      reason: `Für die Stelle wird ${labelFuer("fuehrerschein", anf.fuehrerscheinMin!)} vorausgesetzt.`,
    });
  }

  const deIst = rangDeutsch(k.deutsch);
  const deSoll = rangDeutsch(anf.deutschMin);
  if (deSoll != null && deIst != null && deIst < deSoll) {
    raus.push({
      key: "deutsch",
      label: "Deutschkenntnisse",
      reason:
        `Mindestens ${labelFuer("deutsch", anf.deutschMin!)} verlangt — ` +
        `angegeben: ${labelFuer("deutsch", k.deutsch!)}.`,
    });
  }

  if (
    anf.budgetMonatCents != null &&
    k.gehaltMonatCents != null &&
    anf.budgetMonatCents < k.gehaltMonatCents * GEHALT_TOLERANZ
  ) {
    raus.push({
      key: "gehalt",
      label: "Gehalt",
      reason:
        `Die Stelle ist mit bis zu ${euro(anf.budgetMonatCents)} im Monat hinterlegt — ` +
        `dein Mindestwunsch liegt bei ${euro(k.gehaltMonatCents)}.`,
    });
  }

  return raus;
}

// ── Stufe 2: Punktwertung ───────────────────────────────────────────────────

function bewerteAufgaben(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const treffer = anf.aufgaben.filter((a) => k.aufgaben.includes(a));
  return {
    fulfilment: treffer.length / anf.aufgaben.length,
    note:
      treffer.length === anf.aufgaben.length
        ? "Alle gesuchten Bereiche abgedeckt."
        : `${treffer.length} von ${anf.aufgaben.length} abgedeckt` +
          (treffer.length
            ? `: ${treffer.map((a) => labelFuer("aufgabe", a)).join(", ")}.`
            : "."),
  };
}

function bewerteErfahrung(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const ist = rangErfahrung(k.erfahrung)!;
  const min = rangErfahrung(anf.erfahrungMin);
  const max = rangErfahrung(anf.erfahrungMax);

  if (min != null && ist < min) {
    const stufen = min - ist;
    return {
      fulfilment: Math.max(0, 1 - stufen * 0.5),
      note: `${stufen} Stufe${stufen > 1 ? "n" : ""} unter der gesuchten Erfahrung.`,
    };
  }
  if (max != null && ist > max) {
    const stufen = ist - max;
    return {
      fulfilment: Math.max(0.7, 1 - stufen * 0.1),
      note: "Mehr Erfahrung als gesucht — zählt nur geringfügig ab.",
    };
  }
  return { fulfilment: 1, note: "Liegt in der gesuchten Spanne." };
}

function bewerteWuensche(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const erfuellt = k.wuensche.filter((w) => anf.gebotenes.includes(w));
  return {
    fulfilment: erfuellt.length / k.wuensche.length,
    note: erfuellt.length
      ? `Erfüllt: ${erfuellt.map((w) => labelFuer("wunsch", w)).join(", ")}.`
      : "Keiner deiner Wünsche ist hier hinterlegt.",
  };
}

function bewerteBeruf(anf: Anforderungsprofil, k: Kandidatenprofil) {
  if (anf.berufe.includes(k.ausbildungsberuf!)) {
    return { fulfilment: 1, note: "Genau der gesuchte Ausbildungsberuf." };
  }
  const gewerk = findGewerk(k.gewerk);
  const imSelbenGewerk = gewerk?.berufe.some((b) => anf.berufe.includes(b.value));
  return imSelbenGewerk
    ? { fulfilment: 0.6, note: "Anderer Beruf, aber dasselbe Gewerk — fachlich verwandt." }
    : { fulfilment: 0, note: "Der gesuchte Ausbildungsberuf ist ein anderer." };
}

function bewerteBezeichnung(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const treffer = anf.bezeichnungTags.filter((t) =>
    k.berufsbezeichnungNorm.includes(t),
  );
  if (treffer.length === 0) {
    return {
      fulfilment: 0,
      note: `Gesucht wird ${anf.bezeichnungTags.join(" oder ")} — angegeben ist etwas anderes.`,
    };
  }
  return { fulfilment: 1, note: `Bezeichnung passt („${treffer[0]}").` };
}

function bewerteMeister(k: Kandidatenprofil) {
  if (k.abschluss === "studium") {
    return { fulfilment: 1, note: "Studium — mindestens gleichwertig." };
  }
  if (k.abschluss === "meister_techniker") {
    return {
      fulfilment: 1,
      note: k.meisterQualifikation
        ? `Vorhanden: ${labelFuer("meister", k.meisterQualifikation)}.`
        : "Meister- oder Technikerabschluss vorhanden.",
    };
  }
  return { fulfilment: 0, note: "Kein Meister- oder Technikerabschluss angegeben." };
}

function bewerteFuehrerschein(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const ist = rangFuehrerschein(k.fuehrerschein)!;
  const soll = rangFuehrerschein(anf.fuehrerscheinMin)!;
  if (ist >= soll) return { fulfilment: 1, note: "Vorhanden." };
  if (k.fuehrerschein === "fahrschule") {
    return { fulfilment: 0.5, note: "In der Fahrschule — zählt als halb erfüllt." };
  }
  return {
    fulfilment: 0.3,
    note: `${labelFuer("fuehrerschein", anf.fuehrerscheinMin!)} gesucht, vorhanden ist ${labelFuer("fuehrerschein", k.fuehrerschein!)}.`,
  };
}

function bewerteGehalt(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const budget = anf.budgetMonatCents!;
  const wunsch = k.gehaltMonatCents!;
  if (budget >= wunsch) {
    return {
      fulfilment: 1,
      note: `Budget bis ${euro(budget)} deckt deinen Wunsch von ${euro(wunsch)}.`,
    };
  }
  const anteil = budget / wunsch;
  return {
    fulfilment: Math.max(0, (anteil - GEHALT_TOLERANZ) / (1 - GEHALT_TOLERANZ)),
    note: `Budget bis ${euro(budget)} liegt knapp unter deinem Wunsch von ${euro(wunsch)}.`,
  };
}

function bewerteStart(anf: Anforderungsprofil, k: Kandidatenprofil) {
  const ist = rangStart(k.start)!;
  const soll = rangStart(anf.startBis)!;
  if (ist <= soll) return { fulfilment: 1, note: "Passt zum gesuchten Zeitpunkt." };
  return {
    fulfilment: Math.max(0, 1 - (ist - soll) * 0.1),
    note: `Du möchtest später anfangen als gesucht (${labelFuer("start", k.start!)}).`,
  };
}

/**
 * Vollständige Bewertung einer Stelle für einen Handwerker.
 */
export function bewerte(
  anf: Anforderungsprofil,
  k: Kandidatenprofil,
  lage?: Lage,
): MatchBreakdown {
  const knockouts = ausschlusskriterien(anf, k, lage);
  const gewicht = (key: KriteriumKey) =>
    anf.gewichte?.[key] ?? STANDARD_GEWICHTE[key];

  const zeilen: KriteriumZeile[] = [];
  const pruefe = (
    key: KriteriumKey,
    label: string,
    required: string,
    answer: string,
    anwendbar: boolean,
    bewerten: () => { fulfilment: number; note: string },
  ) => {
    const w = gewicht(key);
    if (!anwendbar || w <= 0) {
      zeilen.push({
        key,
        label,
        required,
        answer,
        weight: w,
        fulfilment: 0,
        penalty: 0,
        maxPenalty: 0,
        skipped: true,
      });
      return;
    }
    const { fulfilment, note } = bewerten();
    const f = Math.min(1, Math.max(0, fulfilment));
    zeilen.push({
      key,
      label,
      required,
      answer,
      weight: w,
      fulfilment: runde2(f),
      penalty: runde2(w * (1 - f)),
      maxPenalty: w,
      skipped: false,
      note,
    });
  };

  pruefe(
    "aufgaben",
    "Aufgabenbereiche",
    anf.aufgaben.map((a) => labelFuer("aufgabe", a)).join(", ") || "—",
    k.aufgaben.map((a) => labelFuer("aufgabe", a)).join(", ") || "—",
    anf.aufgaben.length > 0 && k.aufgaben.length > 0,
    () => bewerteAufgaben(anf, k),
  );

  pruefe(
    "erfahrung",
    "Berufserfahrung",
    anf.erfahrungMin || anf.erfahrungMax
      ? `${labelFuer("erfahrung", anf.erfahrungMin ?? "keine")} bis ${labelFuer("erfahrung", anf.erfahrungMax ?? "ueber_10")}`
      : "—",
    k.erfahrung ? labelFuer("erfahrung", k.erfahrung) : "—",
    rangErfahrung(k.erfahrung) != null &&
      (anf.erfahrungMin != null || anf.erfahrungMax != null),
    () => bewerteErfahrung(anf, k),
  );

  pruefe(
    "beruf",
    "Ausbildungsberuf",
    anf.berufe.map((b) => labelFuer("beruf", b)).join(", ") || "—",
    k.ausbildungsberuf ? labelFuer("beruf", k.ausbildungsberuf) : "—",
    anf.berufe.length > 0 && !!k.ausbildungsberuf,
    () => bewerteBeruf(anf, k),
  );

  pruefe(
    "bezeichnung",
    "Berufsbezeichnung",
    anf.bezeichnungTags.join(", ") || "—",
    k.berufsbezeichnungNorm || "—",
    anf.bezeichnungTags.length > 0 && k.berufsbezeichnungNorm.length > 0,
    () => bewerteBezeichnung(anf, k),
  );

  pruefe(
    "gehalt",
    "Gehalt",
    anf.budgetMonatCents != null ? `bis ${euro(anf.budgetMonatCents)} / Monat` : "—",
    k.gehaltMonatCents != null ? `ab ${euro(k.gehaltMonatCents)} / Monat` : "—",
    anf.budgetMonatCents != null && k.gehaltMonatCents != null,
    () => bewerteGehalt(anf, k),
  );

  pruefe(
    "meister",
    "Meister / Techniker",
    anf.meisterErwuenscht ? "gewünscht" : "—",
    k.abschluss ? labelFuer("abschluss", k.abschluss) : "—",
    anf.meisterErwuenscht && !!k.abschluss,
    () => bewerteMeister(k),
  );

  pruefe(
    "wuensche",
    "Deine Wünsche",
    anf.gebotenes.map((w) => labelFuer("wunsch", w)).join(", ") || "—",
    k.wuensche.map((w) => labelFuer("wunsch", w)).join(", ") || "—",
    k.wuensche.length > 0 && anf.gebotenes.length > 0,
    () => bewerteWuensche(anf, k),
  );

  pruefe(
    "fuehrerschein",
    "Führerschein",
    anf.fuehrerscheinMin ? labelFuer("fuehrerschein", anf.fuehrerscheinMin) : "—",
    k.fuehrerschein ? labelFuer("fuehrerschein", k.fuehrerschein) : "—",
    rangFuehrerschein(anf.fuehrerscheinMin) != null &&
      rangFuehrerschein(anf.fuehrerscheinMin)! > 0 &&
      rangFuehrerschein(k.fuehrerschein) != null,
    () => bewerteFuehrerschein(anf, k),
  );

  pruefe(
    "start",
    "Startzeitpunkt",
    anf.startBis ? labelFuer("start", anf.startBis) : "—",
    k.start ? labelFuer("start", k.start) : "—",
    rangStart(anf.startBis) != null && rangStart(k.start) != null,
    () => bewerteStart(anf, k),
  );

  const bewertet = zeilen.filter((z) => !z.skipped);
  const totalPenalty = runde2(bewertet.reduce((s, z) => s + z.penalty, 0));
  const totalMaxPenalty = bewertet.reduce((s, z) => s + z.maxPenalty, 0);
  const baseScore =
    totalMaxPenalty > 0
      ? Math.min(100, Math.max(0, Math.round(100 * (1 - totalPenalty / totalMaxPenalty))))
      : 100;

  const passed = knockouts.length === 0;
  return {
    passed,
    knockouts,
    criteria: zeilen,
    totalPenalty,
    totalMaxPenalty,
    baseScore: passed ? baseScore : 0,
    adjustments: [],
    score: passed ? baseScore : 0,
    formula: totalMaxPenalty > 0 ? FORMEL : FORMEL_OHNE,
    aiScore: null,
  };
}
