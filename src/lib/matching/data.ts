import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";

/**
 * Geteilte Datenquellen fürs Matching. Die Job- und Kandidatenliste ist für
 * ALLE Bewertungen identisch — sie wird deshalb kurz zwischengespeichert
 * (revalidate), statt bei jedem Kandidatenprofil/Anruf/Match erneut aus der DB
 * zu holen. Das Scoring selbst bleibt pro Aufruf (rechnet nur, keine DB).
 *
 * Frische: ~2 Minuten. Änderungen an Stellen/Kandidaten sind also mit kurzer
 * Verzögerung sichtbar — bei Bedarf gezielt via revalidateTag('jobs'|'candidates').
 */

const REVALIDATE = 120;

/** Aktive Stellen mit allen Matching-Feldern (max. 500, neueste zuerst). */
export const getMatchingJobs = unstable_cache(
  async () =>
    await sql`
      select j.id, j.title, j.city, j.status, j.lat, j.lng, j."companyId", j.gewerk,
             c.name as company_name,
             j.gewerke, j.berufe, j."abschlussMin", j."meisterErwuenscht",
             j.aufgaben, j."aufgabenMin", j."bezeichnungTags",
             j."erfahrungMin", j."erfahrungMax", j."fuehrungGefordert",
             j."montageMin", j."fuehrerscheinMin", j."deutschMin",
             j.gebotenes, j."startBis", j."budgetMonatCents", j.gewichte
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.status = 'ACTIVE'
      order by j."createdAt" desc
      limit 500`,
  ["matching-active-jobs"],
  { revalidate: REVALIDATE, tags: ["jobs"] },
);

/**
 * Kandidaten mit verknüpftem Registrierungsprofil (max. 500, neueste zuerst).
 *
 * WICHTIG: Nur AKTIVIERTE Kandidaten (candidate_meta.aktiviert_at gesetzt) stehen
 * fürs Matching zur Verfügung. Eine Neuregistrierung ist erst „aktiv", nachdem im
 * Callcenter ein Telefonat durchgeführt wurde (außer Sackgasse / geplanter
 * Rückruf). Bis dahin taucht der Account hier — und damit in keinem Matching- oder
 * Vermittlungsbereich — auf. Steuerstelle für „active": src/lib/candidate-status
 * bzw. der Anruf-Ausgang in kandidaten/[id]/anruf/actions.ts.
 */
export const getMatchingCandidates = unstable_cache(
  async () =>
    await sql`
      select a.id, a."firstName", a."lastName", a.profession, a."federalState",
             cp.gewerk, cp.abschluss, cp."berufsbezeichnungNorm", cp.erfahrung,
             cp.fuehrung, cp."meisterQualifikation", cp."meisterQualifikationFrei",
             cp.ausbildungsberuf, cp.aufgaben, cp.wuensche, cp.montage,
             cp.fuehrerschein, cp.deutsch, cp.start, cp."gehaltMonatCents",
             coalesce((
               select json_agg(json_build_object('id', w.id, 'label', w.label,
                 'lat', w.lat, 'lng', w.lng, 'radiusKm', w."radiusKm"))
               from public."WorkLocation" w where w."userId" = u.id), '[]'::json)
               as work_locations
      from admin.candidate a
      join admin.candidate_meta cm
        on cm.application_id = a.id and cm.aktiviert_at is not null
      left join public."User" u on lower(u.email) = lower(a.email)
      left join public."CraftProfile" cp on cp."userId" = u.id
      where a.status <> 'ERASED'
      order by a."createdAt" desc
      limit 500`,
  ["matching-candidates"],
  { revalidate: REVALIDATE, tags: ["candidates"] },
);
