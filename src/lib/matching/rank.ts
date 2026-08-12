import "server-only";
import { sql } from "@/lib/db";
import { bewerte, type MatchBreakdown } from "./scoring";
import {
  anforderungVon,
  extractProfile,
  lageVon,
  profilIstLeer,
  type WorkerProfile,
} from "./profile";

/**
 * Bewertet Stellen für einen Handwerker mit exakt der Engine-Logik:
 * Stufe 1 (harte Ausschlüsse inkl. Arbeitsradius gegen ALLE Arbeitsorte),
 * Stufe 2 (gewichtete Formel, Gewichte 0–5, NaN-fest).
 *
 * Sortierung wie live: bestandene Stellen nach Score absteigend; Inserate ohne
 * ein einziges bewertbares Kriterium (rechnerisch 100 %) ganz nach hinten —
 * die Zahl bleibt, nur die Reihenfolge ändert sich. Ausgeschlossene Stellen
 * werden gezählt und mit Gründen zurückgegeben statt still zu verschwinden.
 */

export interface JobMatch {
  jobId: string;
  title: string;
  city: string | null;
  status: string;
  companyId: string | null;
  companyName: string | null;
  breakdown: MatchBreakdown;
  /** true → keine bewertbaren Kriterien; 100 % ist hier keine Aussage. */
  ohneKriterien: boolean;
}

export interface AusgeblendeteStelle {
  jobId: string;
  title: string;
  companyName: string | null;
  gruende: string[];
}

export interface RankErgebnis {
  profil: WorkerProfile;
  profilLeer: boolean;
  matches: JobMatch[];
  ausgeblendet: {
    gesamt: number;
    gruende: Record<string, number>;
    stellen: AusgeblendeteStelle[];
  };
}

export async function rankJobsForProfile(
  profileData: unknown,
): Promise<RankErgebnis> {
  const profil = extractProfile(profileData);
  const leer = profilIstLeer(profil.profil);

  const jobs = await sql`
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
    limit 500`;

  const matches: JobMatch[] = [];
  const stellenRaus: AusgeblendeteStelle[] = [];
  const gruende: Record<string, number> = {};

  for (const j of jobs) {
    const anf = anforderungVon(j);
    const lage = lageVon(profil, j.lat as number | null, j.lng as number | null);
    const breakdown = bewerte(anf, profil.profil, lage ?? undefined);

    if (!breakdown.passed) {
      for (const k of breakdown.knockouts) {
        gruende[k.label] = (gruende[k.label] ?? 0) + 1;
      }
      stellenRaus.push({
        jobId: j.id as string,
        title: j.title as string,
        companyName: (j.company_name as string) ?? null,
        gruende: breakdown.knockouts.map((k) => `${k.label}: ${k.reason}`),
      });
      continue;
    }

    matches.push({
      jobId: j.id as string,
      title: j.title as string,
      city: (j.city as string) ?? null,
      status: j.status as string,
      companyId: (j.companyId as string) ?? null,
      companyName: (j.company_name as string) ?? null,
      breakdown,
      ohneKriterien: breakdown.totalMaxPenalty === 0,
    });
  }

  matches.sort((a, b) => {
    // Inserate ohne bewertbare Kriterien immer hinter echte Bewertungen.
    if (a.ohneKriterien !== b.ohneKriterien) return a.ohneKriterien ? 1 : -1;
    return b.breakdown.score - a.breakdown.score;
  });

  return {
    profil,
    profilLeer: leer,
    matches,
    ausgeblendet: {
      gesamt: stellenRaus.length,
      gruende,
      stellen: stellenRaus,
    },
  };
}

/**
 * Umgekehrte Richtung: alle Kandidaten (mit verknüpftem User-Profil) gegen
 * EINE Stelle bewerten. Kandidaten ohne verwertbares Profil werden getrennt
 * ausgewiesen statt mit falschen Zahlen zu erscheinen.
 */
export interface CandidateMatch {
  applicationId: string;
  name: string;
  profession: string | null;
  federalState: string | null;
  breakdown: MatchBreakdown;
  ohneKriterien: boolean;
}

export async function rankCandidatesForJob(jobId: string): Promise<{
  bewertet: CandidateMatch[];
  ausgeschlossen: { name: string; applicationId: string; gruende: string[] }[];
  ohneProfil: { name: string; applicationId: string }[];
} | null> {
  const [job] = await sql`
    select j.id, j.lat, j.lng,
           j.bereiche, j.berufe, j."ausbildungMin", j.aufgaben, j."aufgabenMin",
           j."erfahrungMin", j."erfahrungMax", j."montageMin",
           j."fuehrerscheinMin", j."deutschMin", j.gebotenes, j."startBis",
           j.gewichte
    from public."JobPosting" j where j.id = ${jobId}`;
  if (!job) return null;
  const anf = anforderungVon(job);

  const kandidaten = await sql`
    select a.id, a."firstName", a."lastName", a.profession, a."federalState",
           u."profileData"
    from public."Application" a
    left join public."User" u on lower(u.email) = lower(a.email)
    where a.status <> 'ERASED'
    order by a."createdAt" desc
    limit 300`;

  const bewertet: CandidateMatch[] = [];
  const ausgeschlossen: { name: string; applicationId: string; gruende: string[] }[] = [];
  const ohneProfil: { name: string; applicationId: string }[] = [];

  for (const k of kandidaten) {
    const name = `${k.firstName} ${k.lastName}`;
    const profil = extractProfile(k.profileData);
    if (profilIstLeer(profil.profil)) {
      ohneProfil.push({ name, applicationId: k.id as string });
      continue;
    }
    const lage = lageVon(profil, job.lat as number | null, job.lng as number | null);
    const breakdown = bewerte(anf, profil.profil, lage ?? undefined);
    if (!breakdown.passed) {
      ausgeschlossen.push({
        name,
        applicationId: k.id as string,
        gruende: breakdown.knockouts.map((x) => `${x.label}: ${x.reason}`),
      });
      continue;
    }
    bewertet.push({
      applicationId: k.id as string,
      name,
      profession: (k.profession as string) ?? null,
      federalState: (k.federalState as string) ?? null,
      breakdown,
      ohneKriterien: breakdown.totalMaxPenalty === 0,
    });
  }

  bewertet.sort((a, b) => {
    if (a.ohneKriterien !== b.ohneKriterien) return a.ohneKriterien ? 1 : -1;
    return b.breakdown.score - a.breakdown.score;
  });

  return { bewertet, ausgeschlossen, ohneProfil };
}
