import "server-only";
import { sql } from "@/lib/db";
import type {
  Anforderungsprofil,
  Kandidatenprofil,
  KriteriumKey,
  Lage,
} from "./scoring";
import { STANDARD_GEWICHTE } from "./scoring";

/**
 * Profil-Extraktion und Anforderungs-Aufbereitung — 1:1-Port aus dem Backend
 * (`src/matching/matching.service.ts`). Das Fachprofil liegt seit dem
 * Funnel-Umbau in typisierten Spalten (public."CraftProfile") und die Arbeitsorte
 * in public."WorkLocation"; die alten JSON-Pfade (User.profileData) gibt es nicht
 * mehr. Kein Alt-Fallback: die Datenbank wurde geleert, es gibt keine Altdaten.
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

/** Eine gelesene CraftProfile-Zeile (Spalten optional — LEFT JOIN kann leer sein). */
export interface CraftRow {
  gewerk?: string | null;
  abschluss?: string | null;
  berufsbezeichnungNorm?: string | null;
  erfahrung?: string | null;
  fuehrung?: boolean | null;
  meisterQualifikation?: string | null;
  meisterQualifikationFrei?: string | null;
  ausbildungsberuf?: string | null;
  aufgaben?: unknown;
  wuensche?: unknown;
  montage?: string | null;
  fuehrerschein?: string | null;
  deutsch?: string | null;
  start?: string | null;
  gehaltMonatCents?: number | null;
  /** JSON-Array der Arbeitsorte (aus json_agg), optional. */
  work_locations?: unknown;
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;

export const LEER_PROFIL: Kandidatenprofil = {
  gewerk: null,
  abschluss: null,
  berufsbezeichnungNorm: "",
  erfahrung: null,
  fuehrung: false,
  meisterQualifikation: null,
  ausbildungsberuf: null,
  aufgaben: [],
  wuensche: [],
  montage: null,
  fuehrerschein: null,
  deutsch: null,
  start: null,
  gehaltMonatCents: null,
};

/** CraftProfile-Zeile → das Profil, mit dem gerechnet wird. */
export function craftZuKandidat(row: CraftRow): Kandidatenprofil {
  return {
    gewerk: str(row.gewerk),
    abschluss: str(row.abschluss),
    berufsbezeichnungNorm:
      typeof row.berufsbezeichnungNorm === "string" ? row.berufsbezeichnungNorm : "",
    erfahrung: str(row.erfahrung),
    fuehrung: row.fuehrung === true,
    // Für das Matching genügt EIN Meister-Wert: Katalogwert bevorzugt, sonst
    // Freitext (labelFuer gibt Freitext unverändert zurück).
    meisterQualifikation: str(row.meisterQualifikation) ?? str(row.meisterQualifikationFrei),
    ausbildungsberuf: str(row.ausbildungsberuf),
    aufgaben: strArr(row.aufgaben),
    wuensche: strArr(row.wuensche),
    montage: str(row.montage),
    fuehrerschein: str(row.fuehrerschein),
    deutsch: str(row.deutsch),
    start: str(row.start),
    gehaltMonatCents:
      typeof row.gehaltMonatCents === "number" ? row.gehaltMonatCents : null,
  };
}

/** JSON-Array (json_agg) → geprüfte Arbeitsorte. */
export function workLocationsAus(json: unknown): WorkLocation[] {
  const arr = Array.isArray(json) ? json : [];
  return arr
    .filter(
      (l): l is Record<string, unknown> =>
        !!l &&
        typeof (l as { lat?: unknown }).lat === "number" &&
        typeof (l as { lng?: unknown }).lng === "number",
    )
    .map((l) => ({
      id: String(l.id ?? ""),
      label: String(l.label ?? ""),
      lat: l.lat as number,
      lng: l.lng as number,
      radiusKm: typeof l.radiusKm === "number" ? l.radiusKm : 30,
    }));
}

/**
 * Baut das WorkerProfile aus einer Zeile, die die CraftProfile-Spalten UND
 * `work_locations` (JSON) trägt — so, wie getMatchingCandidates sie liefert.
 */
export function extractProfile(row: CraftRow | null | undefined): WorkerProfile {
  const r = row ?? {};
  const profil = r.gewerk ? craftZuKandidat(r) : { ...LEER_PROFIL };
  return { profil, workLocations: workLocationsAus(r.work_locations) };
}

const CRAFT_SELECT = sql`
  cp.gewerk, cp.abschluss, cp."berufsbezeichnungNorm", cp.erfahrung, cp.fuehrung,
  cp."meisterQualifikation", cp."meisterQualifikationFrei", cp.ausbildungsberuf,
  cp.aufgaben, cp.wuensche, cp.montage, cp.fuehrerschein, cp.deutsch, cp.start,
  cp."gehaltMonatCents",
  coalesce((
    select json_agg(json_build_object('id', w.id, 'label', w.label,
      'lat', w.lat, 'lng', w.lng, 'radiusKm', w."radiusKm"))
    from public."WorkLocation" w where w."userId" = u.id), '[]'::json) as work_locations`;

/**
 * Lädt das WorkerProfile eines Kontos (per userId oder E-Mail) aus CraftProfile
 * + WorkLocation. Für Einzel-Ansichten (Kandidatendetail, Anruf, Callcenter …),
 * die früher `User.profileData` gelesen haben.
 */
export async function ladeWorkerProfile(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<WorkerProfile> {
  let userId = opts.userId ?? null;
  if (!userId && opts.email) {
    const [u] = await sql`
      select id from public."User"
      where lower(email) = lower(${opts.email}) and role = 'APPLICANT' limit 1`;
    userId = (u?.id as string) ?? null;
  }
  if (!userId) return { profil: { ...LEER_PROFIL }, workLocations: [] };
  const [row] = await sql`
    select ${CRAFT_SELECT}
    from public."User" u
    left join public."CraftProfile" cp on cp."userId" = u.id
    where u.id = ${userId} limit 1`;
  return extractProfile((row ?? {}) as CraftRow);
}

/** Hat das Konto den Fachfragebogen ausgefüllt? (Gewerk ist Pflichtfeld.) */
export function profilIstLeer(profil: Kandidatenprofil): boolean {
  return !profil.gewerk;
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

/** Liest das Anforderungsprofil aus einer JobPosting-Zeile (neue Spalten). */
export function anforderungVon(posting: {
  gewerke?: unknown;
  berufe?: unknown;
  abschlussMin?: unknown;
  meisterErwuenscht?: unknown;
  aufgaben?: unknown;
  aufgabenMin?: unknown;
  bezeichnungTags?: unknown;
  erfahrungMin?: unknown;
  erfahrungMax?: unknown;
  fuehrungGefordert?: unknown;
  montageMin?: unknown;
  fuehrerscheinMin?: unknown;
  deutschMin?: unknown;
  gebotenes?: unknown;
  startBis?: unknown;
  budgetMonatCents?: unknown;
  gewichte?: unknown;
}): Anforderungsprofil {
  return {
    gewerke: strArr(posting.gewerke),
    berufe: strArr(posting.berufe),
    abschlussMin: str(posting.abschlussMin),
    meisterErwuenscht: posting.meisterErwuenscht === true,
    aufgaben: strArr(posting.aufgaben),
    aufgabenMin:
      typeof posting.aufgabenMin === "number" && posting.aufgabenMin > 0
        ? posting.aufgabenMin
        : 0,
    bezeichnungTags: strArr(posting.bezeichnungTags)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    erfahrungMin: str(posting.erfahrungMin),
    erfahrungMax: str(posting.erfahrungMax),
    fuehrungGefordert: posting.fuehrungGefordert === true,
    montageMin: str(posting.montageMin),
    fuehrerscheinMin: str(posting.fuehrerscheinMin),
    deutschMin: str(posting.deutschMin),
    gebotenes: strArr(posting.gebotenes),
    startBis: str(posting.startBis),
    budgetMonatCents:
      typeof posting.budgetMonatCents === "number" ? posting.budgetMonatCents : null,
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
