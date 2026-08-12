import "server-only";
import type {
  Anforderungsprofil,
  Kandidatenprofil,
  KriteriumKey,
  Lage,
} from "./scoring";
import { STANDARD_GEWICHTE } from "./scoring";

/**
 * Profil-Extraktion und Anforderungs-Aufbereitung — 1:1-Port aus dem Backend
 * (`src/matching/matching.service.ts`), damit Dashboard und Engine dieselben
 * Zahlen liefern. Bewusst NICHT portiert: die Absage-Abzüge (DeclineContext),
 * weil dem Admin-Dashboard die Fahrzeit-Daten fehlen — angezeigte Werte sind
 * daher der Basis-Score der Engine ohne persönliche Absage-Historie.
 */

export interface WorkLocation {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface WorkerProfile {
  profil: Kandidatenprofil;
  workLocations: WorkLocation[];
}

// ── Überleitung alter Profile (vor dem neuen Fragebogen) ────────────────────

const ALT_GEWERK_ZU_BEREICH: Record<string, string> = {
  "Elektriker / Elektroniker": "elektronik",
  "Installateur / Klempner (SHK)": "shk",
  "Heizungs- & Lüftungsbauer": "heizung_lueftung",
  "Maler & Lackierer": "maler",
  "Tischler / Schreiner": "tischler",
  "Maurer / Betonbauer": "maurer",
  Dachdecker: "dachdecker",
  Fliesenleger: "fliesenleger",
  Zimmerer: "zimmerer",
  "Metallbauer / Schlosser": "metallbau",
  "KFZ-Mechatroniker": "kfz",
  Trockenbauer: "trockenbau",
  Gerüstbauer: "geruestbau",
  "Garten- & Landschaftsbau": "galabau",
  "Anderes Gewerk": "sonstiges",
};

function jahreZuStufe(jahre: number): string {
  if (jahre <= 0) return "keine";
  if (jahre <= 2) return "1_2";
  if (jahre <= 5) return "3_5";
  if (jahre <= 10) return "6_10";
  return "ueber_10";
}

function altesProfil(answers: Record<string, unknown>): Kandidatenprofil {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const gewerke = strArr(answers["ai_gewerke"]);
  const zertifikate = strArr(answers["ai_zertifikate"]);
  const bereitschaft = strArr(answers["survey_bereitschaft"]);
  const ziel =
    typeof answers["survey_ziel"] === "string" ? answers["survey_ziel"] : null;

  const ausbildung = zertifikate.some((z) => z === "meister" || z === "techniker")
    ? "techniker_meister"
    : zertifikate.includes("geselle")
      ? "berufsausbildung"
      : null;

  return {
    bereich: ALT_GEWERK_ZU_BEREICH[gewerke[0]] ?? null,
    ausbildungsstatus: ausbildung,
    beruf: null,
    aufgaben: [],
    erfahrung:
      typeof answers["ai_erfahrung"] === "number"
        ? jahreZuStufe(answers["ai_erfahrung"])
        : null,
    prioritaeten: ziel && ziel !== "naehe" ? [ziel] : [],
    montage: bereitschaft.includes("montage") ? "regelmaessig" : null,
    fuehrerschein: zertifikate.includes("fuehrerschein") ? "b" : null,
    deutsch: null,
    start: null,
  };
}

const LEER: Kandidatenprofil = {
  bereich: null,
  ausbildungsstatus: null,
  beruf: null,
  aufgaben: [],
  erfahrung: null,
  prioritaeten: [],
  montage: null,
  fuehrerschein: null,
  deutsch: null,
  start: null,
};

/**
 * Liest das Handwerkerprofil aus `User.profileData`. Die Registrierung legt
 * die Antworten unter `profileData["2"].profil` ab, die Einstellungen direkt
 * unter `profil` — beide Wege werden gelesen; alte Konten werden übergeleitet.
 */
export function extractProfile(profileData: unknown): WorkerProfile {
  const pd = (profileData ?? {}) as Record<string, unknown>;

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const str = (v: unknown): string | null =>
    typeof v === "string" && v ? v : null;

  const ausSchritt = Object.values(pd).find(
    (v): v is Record<string, unknown> =>
      !!v && typeof v === "object" && "profil" in (v as object),
  );
  const neu = (pd["profil"] ??
    (ausSchritt?.["profil"] as unknown) ??
    null) as Record<string, unknown> | null;

  let profil: Kandidatenprofil;
  if (neu && Object.keys(neu).length > 0) {
    profil = {
      bereich: str(neu["bereich"]),
      ausbildungsstatus: str(neu["ausbildungsstatus"]),
      beruf: str(neu["beruf"]),
      aufgaben: strArr(neu["aufgaben"]),
      erfahrung: str(neu["erfahrung"]),
      prioritaeten: strArr(neu["prioritaeten"]),
      montage: str(neu["montage"]),
      fuehrerschein: str(neu["fuehrerschein"]),
      deutsch: str(neu["deutsch"]),
      start: str(neu["start"]),
    };
  } else {
    const steps = pd as Record<string, Record<string, unknown> | undefined>;
    const survey = (steps["1"]?.surveyAnswers ?? {}) as Record<string, unknown>;
    const ai = (steps["4"]?.aiAnswers ?? {}) as Record<string, unknown>;
    const answers = { ...survey, ...ai };
    profil = Object.keys(answers).length > 0 ? altesProfil(answers) : { ...LEER };
  }

  const rawLocations = (pd["3"] as Record<string, unknown> | undefined)?.[
    "workLocations"
  ];
  const workLocations = (Array.isArray(rawLocations) ? rawLocations : [])
    .filter(
      (l): l is WorkLocation =>
        !!l &&
        typeof (l as { lat?: unknown }).lat === "number" &&
        typeof (l as { lng?: unknown }).lng === "number",
    )
    .map((l) => ({
      id: String(l.id ?? ""),
      label: String(l.label ?? ""),
      lat: l.lat,
      lng: l.lng,
      radiusKm: typeof l.radiusKm === "number" ? l.radiusKm : 30,
    }));

  return { profil, workLocations };
}

/** Hat das Profil überhaupt Angaben aus dem Fragebogen? */
export function profilIstLeer(profil: Kandidatenprofil): boolean {
  return (
    !profil.bereich &&
    !profil.ausbildungsstatus &&
    !profil.beruf &&
    profil.aufgaben.length === 0 &&
    !profil.erfahrung &&
    profil.prioritaeten.length === 0 &&
    !profil.montage &&
    !profil.fuehrerschein &&
    !profil.deutsch &&
    !profil.start
  );
}

// ── Gewichte & Anforderungsprofil ───────────────────────────────────────────

/**
 * Gewichte aus der DB sind ungeprüftes JSON — nicht-numerische Werte erzeugten
 * früher NaN und machten das Inserat für JEDEN zum 100-%-Treffer. Unbrauchbare
 * Werte werden verworfen, gültige auf 0–5 begrenzt (wie in der Engine).
 */
export function pruefeGewichte(roh: unknown): Anforderungsprofil["gewichte"] {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return undefined;
  const raus: Partial<Record<KriteriumKey, number>> = {};
  for (const key of Object.keys(STANDARD_GEWICHTE) as KriteriumKey[]) {
    const wert = (roh as Record<string, unknown>)[key];
    if (typeof wert !== "number" || !Number.isFinite(wert)) continue;
    raus[key] = Math.min(5, Math.max(0, Math.round(wert)));
  }
  return Object.keys(raus).length > 0 ? raus : undefined;
}

/** Liest das Anforderungsprofil aus einer JobPosting-Zeile. */
export function anforderungVon(posting: {
  bereiche?: unknown;
  berufe?: unknown;
  ausbildungMin?: unknown;
  aufgaben?: unknown;
  aufgabenMin?: unknown;
  erfahrungMin?: unknown;
  erfahrungMax?: unknown;
  montageMin?: unknown;
  fuehrerscheinMin?: unknown;
  deutschMin?: unknown;
  gebotenes?: unknown;
  startBis?: unknown;
  gewichte?: unknown;
}): Anforderungsprofil {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const str = (v: unknown): string | null =>
    typeof v === "string" && v ? v : null;

  return {
    bereiche: strArr(posting.bereiche),
    berufe: strArr(posting.berufe),
    ausbildungMin: str(posting.ausbildungMin),
    aufgaben: strArr(posting.aufgaben),
    aufgabenMin:
      typeof posting.aufgabenMin === "number" && posting.aufgabenMin > 0
        ? posting.aufgabenMin
        : 0,
    erfahrungMin: str(posting.erfahrungMin),
    erfahrungMax: str(posting.erfahrungMax),
    montageMin: str(posting.montageMin),
    fuehrerscheinMin: str(posting.fuehrerscheinMin),
    deutschMin: str(posting.deutschMin),
    gebotenes: strArr(posting.gebotenes),
    startBis: str(posting.startBis),
    gewichte: pruefeGewichte(posting.gewichte),
  };
}

// ── Lage (Arbeitsradius) ────────────────────────────────────────────────────

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Wo eine Stelle relativ zu den Arbeitsorten liegt. `imRadius` prüft ALLE
 * Orte, nicht nur den nächsten. `null`, wenn sich nichts sagen lässt — dann
 * wird die Entfernung nicht geprüft (Unwissen schließt niemanden aus).
 */
export function lageVon(
  profile: WorkerProfile,
  lat: number | null,
  lng: number | null,
): Lage | null {
  if (lat == null || lng == null || profile.workLocations.length === 0) {
    return null;
  }
  let best: { location: WorkLocation; distanceKm: number } | null = null;
  for (const loc of profile.workLocations) {
    const d = haversineKm(loc.lat, loc.lng, lat, lng);
    if (!best || d < best.distanceKm) best = { location: loc, distanceKm: d };
  }
  const imRadius = profile.workLocations.some(
    (l) => haversineKm(l.lat, l.lng, lat, lng) <= l.radiusKm,
  );
  return {
    km: best!.distanceKm,
    radiusKm: best!.location.radiusKm,
    ort: best!.location.label,
    imRadius,
  };
}
