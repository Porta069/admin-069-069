import "server-only";
import { sql } from "@/lib/db";
import { labelFuer } from "./catalog";

/**
 * Bereitet das Handwerker-Fachprofil (public."CraftProfile" + "WorkLocation")
 * für die lesbare Anzeige im Dashboard auf — Slugs werden über den
 * Matching-Katalog in Klartext übersetzt. Serverseitig, dieselbe Quelle wie die
 * Engine.
 */

export interface ProfilFeld {
  label: string;
  wert: string;
}
export interface ProfilAnzeige {
  felder: ProfilFeld[];
  aufgaben: string[];
  wuensche: string[];
  arbeitsorte: { label: string; radiusKm: number }[];
  leer: boolean;
}

/** Rohzeile fürs Anzeigen (CraftProfile-Spalten + Arbeitsorte als JSON). */
export interface CraftAnzeigeRow {
  gewerk?: string | null;
  abschluss?: string | null;
  berufsbezeichnung?: string | null;
  studium?: string | null;
  meisterQualifikation?: string | null;
  meisterQualifikationFrei?: string | null;
  ausbildungsberuf?: string | null;
  erfahrung?: string | null;
  fuehrung?: boolean | null;
  aufgaben?: unknown;
  wuensche?: unknown;
  montage?: string | null;
  fuehrerschein?: string | null;
  deutsch?: string | null;
  start?: string | null;
  gehaltMonatCents?: number | null;
  work_locations?: unknown;
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const euroMonat = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " € / Monat";

/** Baut die Anzeige aus einer bereits gelesenen CraftProfile-Zeile. */
export function profilAnzeigeAusRow(row: CraftAnzeigeRow | null | undefined): ProfilAnzeige {
  const r = row ?? {};
  const felder: ProfilFeld[] = [];
  const push = (label: string, wert: string | null | undefined) => {
    if (wert) felder.push({ label, wert });
  };
  const lbl = (art: string, v: string | null | undefined) =>
    v ? labelFuer(art, v) : null;

  push("Gewerk", lbl("gewerk", r.gewerk));
  push("Berufsbezeichnung", r.berufsbezeichnung ?? null);
  push("Abschluss", lbl("abschluss", r.abschluss));
  if (r.abschluss === "studium") push("Studium", r.studium ?? null);
  push(
    "Meister / Techniker",
    r.meisterQualifikation
      ? labelFuer("meister", r.meisterQualifikation)
      : (r.meisterQualifikationFrei ?? null),
  );
  push("Ausbildungsberuf", lbl("beruf", r.ausbildungsberuf));
  push("Erfahrung", lbl("erfahrung", r.erfahrung));
  if (r.fuehrung === true) push("Führungsverantwortung", "Ja");
  push("Führerschein", lbl("fuehrerschein", r.fuehrerschein));
  push("Deutsch", lbl("deutsch", r.deutsch));
  push("Montagebereitschaft", lbl("montage", r.montage));
  push("Frühester Start", lbl("start", r.start));
  // Gehalt: NULL heißt „keine Angabe" — nicht 0 und nicht „egal".
  push(
    "Gehaltswunsch",
    typeof r.gehaltMonatCents === "number"
      ? `ab ${euroMonat(r.gehaltMonatCents)}`
      : "keine Angabe",
  );

  const aufgaben = strArr(r.aufgaben).map((a) => labelFuer("aufgabe", a));
  const wuensche = strArr(r.wuensche).map((w) => labelFuer("wunsch", w));
  const arbeitsorte = (Array.isArray(r.work_locations) ? r.work_locations : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .map((l) => ({
      label: String(l.label ?? ""),
      radiusKm: typeof l.radiusKm === "number" ? l.radiusKm : 30,
    }));

  return {
    felder,
    aufgaben,
    wuensche,
    arbeitsorte,
    leer: !r.gewerk,
  };
}

const ANZEIGE_SELECT = sql`
  cp.gewerk, cp.abschluss, cp.berufsbezeichnung, cp.studium,
  cp."meisterQualifikation", cp."meisterQualifikationFrei", cp.ausbildungsberuf,
  cp.erfahrung, cp.fuehrung, cp.aufgaben, cp.wuensche, cp.montage,
  cp.fuehrerschein, cp.deutsch, cp.start, cp."gehaltMonatCents",
  coalesce((
    select json_agg(json_build_object('label', w.label, 'radiusKm', w."radiusKm"))
    from public."WorkLocation" w where w."userId" = u.id), '[]'::json) as work_locations`;

/** Lädt und rendert das Fachprofil eines Kontos (per userId oder E-Mail). */
export async function ladeProfilAnzeige(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<ProfilAnzeige> {
  let userId = opts.userId ?? null;
  if (!userId && opts.email) {
    const [u] = await sql`
      select id from public."User"
      where lower(email) = lower(${opts.email}) and role = 'APPLICANT' limit 1`;
    userId = (u?.id as string) ?? null;
  }
  if (!userId) return profilAnzeigeAusRow(null);
  const [row] = await sql`
    select ${ANZEIGE_SELECT}
    from public."User" u
    left join public."CraftProfile" cp on cp."userId" = u.id
    where u.id = ${userId} limit 1`;
  return profilAnzeigeAusRow((row ?? {}) as CraftAnzeigeRow);
}

/** Gewerk- bzw. Berufs-Slug → Klartext (für Listen/Kopfzeilen). */
export function professionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const gewerk = labelFuer("gewerk", value);
  if (gewerk !== value) return gewerk;
  const beruf = labelFuer("beruf", value);
  return beruf !== value ? beruf : value;
}
