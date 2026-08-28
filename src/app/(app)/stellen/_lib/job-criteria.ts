/**
 * Matching-Vokabular für den Inserats-Editor — dünner Adapter über den 1:1
 * portierten Engine-Katalog (src/lib/matching/catalog.ts). Werte/Labels kommen
 * aus derselben Datei wie die Engine. Für Gewerke/Berufe/Aufgaben liefern die
 * Server-Seiten zusätzlich den LIVE-Katalog (GET /catalog) über Props — diese
 * statischen Exporte sind die Rückfallebene.
 */

import {
  ABSCHLUSS,
  DEUTSCH,
  ERFAHRUNG,
  FUEHRERSCHEIN,
  GEWERKE,
  MONTAGE,
  START,
  WUENSCHE,
  findGewerk,
  labelFuer,
  type Gewerk,
} from "@/lib/matching/catalog";
import { STANDARD_GEWICHTE, type KriteriumKey } from "@/lib/matching/scoring";

export interface LevelOption {
  value: string;
  label: string;
}

const toOptions = (skala: { value: string; label: string }[]): LevelOption[] =>
  skala.map((o) => ({ value: o.value, label: o.label }));

// ── Aus dem Engine-Katalog abgeleitet ──────────────────────────────────────

export const GEWERK_OPTIONS: LevelOption[] = toOptions(GEWERKE);

export const BERUF_LABELS: Record<string, string> = Object.fromEntries(
  GEWERKE.flatMap((g) => g.berufe.map((beruf) => [beruf.value, beruf.label])),
);

export const ERFAHRUNG_OPTIONS: LevelOption[] = toOptions(ERFAHRUNG);
export const ABSCHLUSS_OPTIONS: LevelOption[] = toOptions(ABSCHLUSS);
export const DEUTSCH_OPTIONS: LevelOption[] = toOptions(DEUTSCH);
export const FUEHRERSCHEIN_OPTIONS: LevelOption[] = toOptions(FUEHRERSCHEIN);
export const MONTAGE_MIN_OPTIONS: LevelOption[] = toOptions(MONTAGE);
export const WUENSCHE_OPTIONS: LevelOption[] = toOptions(WUENSCHE);
export const START_OPTIONS: LevelOption[] = toOptions(START);

/** Freitext-Feld JobPosting.montage — bekannte Plattform-Werte (nur Anzeige). */
export const MONTAGE_TEXT_OPTIONS = [
  "Jeden Abend zuhause",
  "Gelegentlich Montage",
  "Dauermontage",
];

/** Aufgaben-Optionen der gewählten Gewerke (Gewerk bringt seine Aufgaben mit). */
export function aufgabenOptionsFuer(
  gewerke: string[],
  katalogGewerke: Gewerk[] = GEWERKE,
): LevelOption[] {
  const seen = new Set<string>();
  const out: LevelOption[] = [];
  for (const wert of gewerke) {
    const gewerk = katalogGewerke.find((g) => g.value === wert);
    for (const aufgabe of gewerk?.aufgaben ?? []) {
      if (!seen.has(aufgabe.value)) {
        seen.add(aufgabe.value);
        out.push({ value: aufgabe.value, label: aufgabe.label });
      }
    }
  }
  return out;
}

/** Berufs-Optionen der gewählten Gewerke (Gewerk bringt seine Berufe mit). */
export function berufeOptionsFuer(
  gewerke: string[],
  katalogGewerke: Gewerk[] = GEWERKE,
): LevelOption[] {
  const seen = new Set<string>();
  const out: LevelOption[] = [];
  for (const wert of gewerke) {
    const gewerk = katalogGewerke.find((g) => g.value === wert);
    for (const beruf of gewerk?.berufe ?? []) {
      if (!seen.has(beruf.value)) {
        seen.add(beruf.value);
        out.push({ value: beruf.value, label: beruf.label });
      }
    }
  }
  return out;
}

// ── Gewichte: exakt die neun Kriterien der Engine, Skala 0–5 ───────────────

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 5;

export const WEIGHT_LABELS: Record<string, string> = {
  aufgaben: "Aufgabenbereiche",
  erfahrung: "Berufserfahrung",
  beruf: "Ausbildungsberuf",
  bezeichnung: "Berufsbezeichnung",
  gehalt: "Gehalt",
  wuensche: "Wünsche des Handwerkers",
  fuehrerschein: "Führerschein",
  meister: "Meister / Techniker",
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

export function gewerkLabel(slug: string): string {
  return findGewerk(slug)?.label ?? humanizeSlug(slug);
}

export function aufgabeLabel(slug: string): string {
  const label = labelFuer("aufgabe", slug);
  return label === slug ? humanizeSlug(slug) : label;
}

export function wunschLabel(slug: string): string {
  const label = labelFuer("wunsch", slug);
  return label === slug ? humanizeSlug(slug) : label;
}

export function abschlussLabel(slug: string): string {
  const label = labelFuer("abschluss", slug);
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
  gewerke: string[] | null;
  berufe: string[] | null;
  abschlussMin: string | null;
  meisterErwuenscht: boolean | null;
  aufgaben: string[] | null;
  aufgabenMin: number | null;
  bezeichnungTags: string[] | null;
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  fuehrungGefordert: boolean | null;
  montageMin: string | null;
  fuehrerscheinMin: string | null;
  deutschMin: string | null;
  gebotenes: string[] | null;
  startBis: string | null;
  budgetMonatCents: number | null;
  city: string | null;
  gewichte: Record<string, unknown> | null;
}

export interface IdealProfileRow {
  key: string;
  label: string;
  value: string;
  /** Gewicht 0–5 bei Punktwertungs-Kriterien, null bei Ausschlusskriterien. */
  weight: number | null;
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

const euroMonat = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " € / Monat";

/**
 * Zeilen des optimalen Kandidatenprofils, nach den zwei Engine-Stufen getrennt:
 * gewichtete Kriterien (nach Gewicht absteigend), dann harte Ausschlüsse.
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
    const min = job.erfahrungMin ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMin) : null;
    const max = job.erfahrungMax ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMax) : null;
    gewichtet.push({
      key: "erfahrung",
      label: "Berufserfahrung",
      value: min && max ? `${min} bis ${max}` : min ? `mind. ${min}` : `bis ${max}`,
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

  const tags = (job.bezeichnungTags ?? []).filter(Boolean);
  if (tags.length > 0) {
    gewichtet.push({
      key: "bezeichnung",
      label: "Berufsbezeichnung",
      value: `Stichworte: ${tags.join(", ")}`,
      weight: readWeight(g, "bezeichnung"),
      art: "gewichtet",
    });
  }

  if (job.budgetMonatCents != null) {
    gewichtet.push({
      key: "gehalt",
      label: "Gehalt",
      value: `Budget bis ${euroMonat(job.budgetMonatCents)}`,
      weight: readWeight(g, "gehalt"),
      art: "gewichtet",
    });
  }

  const gebotenes = (job.gebotenes ?? []).filter(Boolean);
  if (gebotenes.length > 0) {
    gewichtet.push({
      key: "wuensche",
      label: "Wünsche des Handwerkers",
      value: `Betrieb bietet: ${gebotenes.map(wunschLabel).join(", ")}`,
      weight: readWeight(g, "wuensche"),
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

  if (job.meisterErwuenscht) {
    gewichtet.push({
      key: "meister",
      label: "Meister / Techniker",
      value: "gewünscht (zählt Punkte, schließt nicht aus)",
      weight: readWeight(g, "meister"),
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
  const gewerke = (job.gewerke ?? []).filter(Boolean);
  if (gewerke.length > 0) {
    ausschluss.push({
      key: "gewerk",
      label: "Gewerk",
      value: gewerke.map(gewerkLabel).join(" oder "),
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

  if (job.abschlussMin) {
    ausschluss.push({
      key: "abschluss",
      label: "Mindestabschluss",
      value: `mind. ${levelLabel(ABSCHLUSS_OPTIONS, job.abschlussMin)}`,
      weight: null,
      art: "ausschluss",
    });
  }

  if (job.fuehrungGefordert) {
    ausschluss.push({
      key: "fuehrung",
      label: "Führungsverantwortung",
      value: "verlangt",
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
