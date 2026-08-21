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
      select j.id, j.title, j.city, j.status, j.lat, j.lng, j."companyId",
             c.name as company_name,
             j.bereiche, j.berufe, j."ausbildungMin", j.aufgaben, j."aufgabenMin",
             j."erfahrungMin", j."erfahrungMax", j."montageMin",
             j."fuehrerscheinMin", j."deutschMin", j.gebotenes, j."startBis",
             j.gewichte
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.status = 'ACTIVE'
      order by j."createdAt" desc
      limit 500`,
  ["matching-active-jobs"],
  { revalidate: REVALIDATE, tags: ["jobs"] },
);

/** Kandidaten mit verknüpftem Registrierungsprofil (max. 500, neueste zuerst). */
export const getMatchingCandidates = unstable_cache(
  async () =>
    await sql`
      select a.id, a."firstName", a."lastName", a.profession, a."federalState",
             u."profileData"
      from admin.candidate a
      left join public."User" u on lower(u.email) = lower(a.email)
      where a.status <> 'ERASED'
      order by a."createdAt" desc
      limit 500`,
  ["matching-candidates"],
  { revalidate: REVALIDATE, tags: ["candidates"] },
);
