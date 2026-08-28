import "server-only";
import { getMatchingCandidates } from "./data";
import { bewerte } from "./scoring";
import {
  anforderungVon,
  extractProfile,
  profilIstLeer,
} from "./profile";

/**
 * Ad-hoc-Kandidatensuche: Ein Mitarbeiter beantwortet die 10 Fachfragen im
 * gleichen Format wie die Registrierung; daraus wird eine Stellen-Anforderung
 * gebaut und mit exakt der Matching-Engine gegen alle registrierten
 * Jobsuchenden bewertet. Ohne Speichern (Einmal-Suche) — oder als Stelle
 * sichern (siehe kriterienZuStelle + speichereAlsStelle in der Bereichs-Action).
 */

/** Suchkriterien im Kandidaten-Antwortformat (identisch zur Registrierung). */
export interface SuchKriterien {
  gewerk: string | null;
  abschluss: string | null;
  ausbildungsberuf: string | null;
  /** Freitext — sucht in der normierten Berufsbezeichnung des Kandidaten. */
  berufsbezeichnung: string | null;
  aufgaben: string[];
  erfahrung: string | null;
  wuensche: string[];
  montage: string | null;
  fuehrerschein: string | null;
  deutsch: string | null;
  start: string | null;
}

/** Kandidaten-Antwortformat → Stellen-Anforderung (Engine UND Speichern). */
export function kriterienZuStelle(k: SuchKriterien) {
  return {
    gewerke: k.gewerk ? [k.gewerk] : [],
    berufe: k.ausbildungsberuf ? [k.ausbildungsberuf] : [],
    abschlussMin: k.abschluss ?? null,
    aufgaben: k.aufgaben,
    // 0 = Aufgaben zählen gewichtet, nicht als hartes Ausschlusskriterium.
    aufgabenMin: 0,
    bezeichnungTags: k.berufsbezeichnung ? [k.berufsbezeichnung] : [],
    erfahrungMin: k.erfahrung ?? null,
    erfahrungMax: null as string | null,
    montageMin: k.montage ?? null,
    fuehrerscheinMin: k.fuehrerschein ?? null,
    deutschMin: k.deutsch ?? null,
    gebotenes: k.wuensche,
    startBis: k.start ?? null,
    gewichte: null as unknown,
  };
}

export interface SuchKandidat {
  applicationId: string;
  name: string;
  profession: string | null;
  federalState: string | null;
  score: number;
  /** true → keine bewertbaren Kriterien; die 100 % sind hier keine Aussage. */
  ohneKriterien: boolean;
}

export interface SuchErgebnis {
  bewertet: SuchKandidat[];
  ausgeschlossen: number;
  ohneProfil: number;
  gesamtGeprueft: number;
  /** Ist überhaupt ein Kriterium gesetzt? Sonst ist die Liste bedeutungslos. */
  kriterienGesetzt: boolean;
}

export async function rankCandidatesForKriterien(
  k: SuchKriterien,
  limit = 100,
): Promise<SuchErgebnis> {
  const anf = anforderungVon(kriterienZuStelle(k));
  const gesetzt =
    anf.gewerke.length > 0 ||
    anf.berufe.length > 0 ||
    anf.aufgaben.length > 0 ||
    anf.bezeichnungTags.length > 0 ||
    Boolean(anf.abschlussMin) ||
    Boolean(anf.erfahrungMin) ||
    Boolean(anf.montageMin) ||
    Boolean(anf.fuehrerscheinMin) ||
    Boolean(anf.deutschMin) ||
    anf.gebotenes.length > 0 ||
    Boolean(anf.startBis);

  const kandidaten = await getMatchingCandidates();

  const bewertet: SuchKandidat[] = [];
  let ausgeschlossen = 0;
  let ohneProfil = 0;

  for (const c of kandidaten) {
    const profil = extractProfile(c);
    if (profilIstLeer(profil.profil)) {
      ohneProfil++;
      continue;
    }
    // Ohne Ortsprüfung (keine Geokodierung im Ad-hoc-Modus) — Ort schließt
    // hier niemanden aus; beim Speichern als Stelle übernimmt der Betrieb den Ort.
    const breakdown = bewerte(anf, profil.profil, undefined);
    if (!breakdown.passed) {
      ausgeschlossen++;
      continue;
    }
    bewertet.push({
      applicationId: c.id as string,
      name: `${c.firstName} ${c.lastName}`,
      profession: (c.profession as string) ?? null,
      federalState: (c.federalState as string) ?? null,
      score: breakdown.score,
      ohneKriterien: breakdown.totalMaxPenalty === 0,
    });
  }

  bewertet.sort((a, b) => {
    if (a.ohneKriterien !== b.ohneKriterien) return a.ohneKriterien ? 1 : -1;
    return b.score - a.score;
  });

  return {
    bewertet: bewertet.slice(0, limit),
    ausgeschlossen,
    ohneProfil,
    gesamtGeprueft: kandidaten.length,
    kriterienGesetzt: gesetzt,
  };
}
