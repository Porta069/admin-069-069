/**
 * Matching-Vokabular — dünner Adapter über den 1:1 portierten Engine-Katalog
 * (src/lib/matching/catalog.ts). KEIN eigener Datenbestand mehr: Werte und
 * Labels kommen aus derselben Datei, die auch die Engine im Backend nutzt.
 * Für Bereiche/Berufe/Aufgaben liefern die Server-Seiten zusätzlich den
 * LIVE-Katalog (GET /catalog, stündlich revalidiert) über Props — diese
 * statischen Exporte sind die Rückfallebene.
 */

import {
  AUSBILDUNGSSTATUS,
  BEREICHE,
  DEUTSCH,
  ERFAHRUNG,
  FUEHRERSCHEIN,
  MONTAGE,
  PRIORITAETEN,
  START,
  findBereich,
  labelFuer,
  type Bereich,
} from "@/lib/matching/catalog";
import { STANDARD_GEWICHTE, type KriteriumKey } from "@/lib/matching/scoring";

export interface LevelOption {
  value: string;
  label: string;
}

const toOptions = (skala: { value: string; label: string }[]): LevelOption[] =>
  skala.map((o) => ({ value: o.value, label: o.label }));

// ── Aus dem Engine-Katalog abgeleitet ──────────────────────────────────────

export const BEREICH_OPTIONS: LevelOption[] = toOptions(BEREICHE);

export const BERUF_LABELS: Record<string, string> = Object.fromEntries(
  BEREICHE.flatMap((b) => b.berufe.map((beruf) => [beruf.value, beruf.label])),
);

export const ERFAHRUNG_OPTIONS: LevelOption[] = toOptions(ERFAHRUNG);
export const AUSBILDUNG_OPTIONS: LevelOption[] = toOptions(AUSBILDUNGSSTATUS);
export const DEUTSCH_OPTIONS: LevelOption[] = toOptions(DEUTSCH);
export const FUEHRERSCHEIN_OPTIONS: LevelOption[] = toOptions(FUEHRERSCHEIN);
export const MONTAGE_MIN_OPTIONS: LevelOption[] = toOptions(MONTAGE);
export const PRIORITAETEN_OPTIONS: LevelOption[] = toOptions(PRIORITAETEN);
export const START_OPTIONS: LevelOption[] = toOptions(START);

/** Freitext-Feld JobPosting.montage — bekannte Plattform-Werte (nur Anzeige). */
export const MONTAGE_TEXT_OPTIONS = [
  "Jeden Abend zuhause",
  "Gelegentlich Montage",
  "Dauermontage",
];

/** Aufgaben-Optionen der gewählten Bereiche (Bereich bringt seine Aufgaben mit). */
export function aufgabenOptionsFuer(
  bereiche: string[],
  katalogBereiche: Bereich[] = BEREICHE,
): LevelOption[] {
  const seen = new Set<string>();
  const out: LevelOption[] = [];
  for (const wert of bereiche) {
    const bereich = katalogBereiche.find((b) => b.value === wert);
    for (const aufgabe of bereich?.aufgaben ?? []) {
      if (!seen.has(aufgabe.value)) {
        seen.add(aufgabe.value);
        out.push({ value: aufgabe.value, label: aufgabe.label });
      }
    }
  }
  return out;
}

/** Berufs-Optionen der gewählten Bereiche (Bereich bringt seine Berufe mit). */
export function berufeOptionsFuer(
  bereiche: string[],
  katalogBereiche: Bereich[] = BEREICHE,
): LevelOption[] {
  const seen = new Set<string>();
  const out: LevelOption[] = [];
  for (const wert of bereiche) {
    const bereich = katalogBereiche.find((b) => b.value === wert);
    for (const beruf of bereich?.berufe ?? []) {
      if (!seen.has(beruf.value)) {
        seen.add(beruf.value);
        out.push({ value: beruf.value, label: beruf.label });
      }
    }
  }
  return out;
}

// ── Gewichte: exakt die sechs Kriterien der Engine, Skala 0–5 ──────────────

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 5;

export const WEIGHT_LABELS: Record<string, string> = {
  aufgaben: "Aufgabenbereiche",
  erfahrung: "Berufserfahrung",
  beruf: "Ausbildungsberuf",
  prioritaeten: "Prioritäten des Handwerkers",
  fuehrerschein: "Führerschein",
  start: "Startzeitpunkt",
};

export const WEIGHT_CRITERIA: LevelOption[] = (
  Object.keys(STANDARD_GEWICHTE) as KriteriumKey[]
).map((key) => ({ value: key, label: weightLabel(key) }));

export { STANDARD_GEWICHTE };
export type { KriteriumKey };


// ── Label-Helfer ───────────────────────────────────────────────────────────

export function humanizeSlug(slug: string): string {
  return slug
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export function berufLabel(slug: string): string {
  return BERUF_LABELS[slug] ?? humanizeSlug(slug);
}

export function bereichLabel(slug: string): string {
  return findBereich(slug)?.label ?? humanizeSlug(slug);
}

export function aufgabeLabel(slug: string): string {
  const label = labelFuer("aufgabe", slug);
  return label === slug ? humanizeSlug(slug) : label;
}

export function prioLabel(slug: string): string {
  const label = labelFuer("prio", slug);
  return label === slug ? humanizeSlug(slug) : label;
}

export function levelLabel(options: LevelOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? humanizeSlug(value);
}

export function weightLabel(key: string): string {
  return WEIGHT_LABELS[key.toLowerCase()] ?? humanizeSlug(key);
}

// ── Optimales Kandidatenprofil aus Job-Feldern ─────────────────────────────

export interface JobCriteriaFields {
  berufe: string[] | null;
  bereiche: string[] | null;
  aufgaben: string[] | null;
  aufgabenMin: number | null;
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  ausbildungMin: string | null;
  deutschMin: string | null;
  fuehrerscheinMin: string | null;
  montageMin: string | null;
  gebotenes: string[] | null;
  startBis: string | null;
  city: string | null;
  gewichte: Record<string, unknown> | null;
}

export interface IdealProfileRow {
  key: string;
  label: string;
  value: string;
  /** Gewicht 0–5 bei Punktwertungs-Kriterien, null bei Ausschlusskriterien. */
  weight: number | null;
  /** Stufe 1 (Ausschluss) oder Stufe 2 (Punktwertung). */
  art: "ausschluss" | "gewichtet";
}

function readWeight(
  gewichte: Record<string, unknown> | null,
  key: KriteriumKey,
): number {
  const raw = gewichte?.[key];
  const num = typeof raw === "number" ? raw : Number(raw);
  const wert = raw != null && Number.isFinite(num) ? num : STANDARD_GEWICHTE[key];
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(wert)));
}

/**
 * Zeilen des optimalen Kandidatenprofils, sauber nach den zwei Stufen der
 * Engine getrennt: gewichtete Kriterien (nach Gewicht absteigend), dann die
 * harten Ausschlusskriterien. Leere Kriterien entfallen.
 */
export function buildIdealProfile(job: JobCriteriaFields): IdealProfileRow[] {
  const g = job.gewichte ?? null;
  const gewichtet: IdealProfileRow[] = [];
  const ausschluss: IdealProfileRow[] = [];

  // ── Stufe 2: Punktwertung ────────────────────────────────────────────
  const aufgaben = (job.aufgaben ?? []).filter(Boolean);
  if (aufgaben.length > 0) {
    gewichtet.push({
      key: "aufgaben",
      label: "Aufgabenbereiche",
      value: aufgaben.map(aufgabeLabel).join(", "),
      weight: readWeight(g, "aufgaben"),
      art: "gewichtet",
    });
  }

  if (job.erfahrungMin || job.erfahrungMax) {
    const min = job.erfahrungMin
      ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMin)
      : null;
    const max = job.erfahrungMax
      ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMax)
      : null;
    gewichtet.push({
      key: "erfahrung",
      label: "Berufserfahrung",
      value:
        min && max ? `${min} bis ${max}` : min ? `mind. ${min}` : `bis ${max}`,
      weight: readWeight(g, "erfahrung"),
      art: "gewichtet",
    });
  }

  const berufe = (job.berufe ?? []).filter(Boolean);
  if (berufe.length > 0) {
    gewichtet.push({
      key: "beruf",
      label: "Ausbildungsberuf",
      value: berufe.map(berufLabel).join(", "),
      weight: readWeight(g, "beruf"),
      art: "gewichtet",
    });
  }

  const gebotenes = (job.gebotenes ?? []).filter(Boolean);
  if (gebotenes.length > 0) {
    gewichtet.push({
      key: "prioritaeten",
      label: "Prioritäten des Handwerkers",
      value: `Betrieb bietet: ${gebotenes.map(prioLabel).join(", ")}`,
      weight: readWeight(g, "prioritaeten"),
      art: "gewichtet",
    });
  }

  if (job.fuehrerscheinMin) {
    gewichtet.push({
      key: "fuehrerschein",
      label: "Führerschein",
      value: `mind. ${levelLabel(FUEHRERSCHEIN_OPTIONS, job.fuehrerscheinMin)} (nur „gar keiner" schließt aus)`,
      weight: readWeight(g, "fuehrerschein"),
      art: "gewichtet",
    });
  }

  if (job.startBis) {
    gewichtet.push({
      key: "start",
      label: "Startzeitpunkt",
      value: `bis: ${levelLabel(START_OPTIONS, job.startBis)}`,
      weight: readWeight(g, "start"),
      art: "gewichtet",
    });
  }

  // ── Stufe 1: Ausschluss ──────────────────────────────────────────────
  const bereiche = (job.bereiche ?? []).filter(Boolean);
  if (bereiche.length > 0) {
    ausschluss.push({
      key: "bereich",
      label: "Ausbildungsbereich",
      value: bereiche.map(bereichLabel).join(" oder "),
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.aufgabenMin && job.aufgabenMin > 0 && aufgaben.length > 0) {
    ausschluss.push({
      key: "aufgabenMin",
      label: "Aufgaben-Mindestabdeckung",
      value: `mind. ${Math.min(job.aufgabenMin, aufgaben.length)} der gesuchten Bereiche`,
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.ausbildungMin) {
    ausschluss.push({
      key: "ausbildung",
      label: "Ausbildungsstand",
      value: `mind. ${levelLabel(AUSBILDUNG_OPTIONS, job.ausbildungMin)}`,
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.montageMin) {
    ausschluss.push({
      key: "montage",
      label: "Montagebereitschaft",
      value: `mind. ${levelLabel(MONTAGE_MIN_OPTIONS, job.montageMin)}`,
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.deutschMin) {
    ausschluss.push({
      key: "deutsch",
      label: "Deutschkenntnisse",
      value: `mind. ${levelLabel(DEUTSCH_OPTIONS, job.deutschMin)}`,
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.city) {
    ausschluss.push({
      key: "entfernung",
      label: "Arbeitsradius",
      value: `Stelle in ${job.city} muss im Radius eines Arbeitsorts liegen (alle Orte zählen)`,
      weight: null,
      art: "ausschluss",
    });
  }

  gewichtet.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  return [...gewichtet, ...ausschluss];
}
