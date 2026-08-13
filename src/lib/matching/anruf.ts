import "server-only";
import { sql } from "@/lib/db";
import {
  AUSBILDUNGSSTATUS,
  DEUTSCH,
  ERFAHRUNG,
  FUEHRERSCHEIN,
  MONTAGE,
  PRIORITAETEN,
  START,
  labelFuer,
} from "./catalog";
import { extractProfile, profilIstLeer } from "./profile";
import type { Kandidatenprofil } from "./scoring";
import { rankJobsForProfile, type JobMatch } from "./rank";
import { kiJson, kiVerfuegbar, cached } from "@/lib/ki";

/**
 * Anruf-Interface: findet die Fragen, die die Top-Jobs eines Kandidaten am
 * stärksten voneinander trennen, damit ein kurzes Telefonat den besten Match
 * schärft. Token-Doktrin: Die AUSWAHL der Kriterien ist deterministisch
 * (gratis); die KI formuliert die Fragen nur natürlicher (billig, gecacht) und
 * ist optional — ohne Key greifen Vorlagen.
 */

/** Profilfeld → Katalog-Skala + welche „unbekannt"-Werte gefragt werden sollen. */
const KRITERIEN: Record<
  string,
  { label: string; skala: { value: string; label: string }[]; frage: string }
> = {
  montage: {
    label: "Montagebereitschaft",
    skala: MONTAGE,
    frage: "Wie sieht es mit Montage aus — wärst du bereit, auswärts zu übernachten, und wenn ja, wie oft?",
  },
  fuehrerschein: {
    label: "Führerschein",
    skala: FUEHRERSCHEIN,
    frage: "Welchen Führerschein hast du?",
  },
  start: {
    label: "Startzeitpunkt",
    skala: START,
    frage: "Ab wann könntest du anfangen?",
  },
  deutsch: {
    label: "Deutschkenntnisse",
    skala: DEUTSCH,
    frage: "Wie schätzt du deine Deutschkenntnisse ein?",
  },
  erfahrung: {
    label: "Berufserfahrung",
    skala: ERFAHRUNG,
    frage: "Wie viele Jahre Berufserfahrung bringst du mit?",
  },
  ausbildungsstatus: {
    label: "Ausbildungsstand",
    skala: AUSBILDUNGSSTATUS,
    frage: "Welchen Ausbildungsabschluss hast du?",
  },
};

export interface AnrufFrage {
  /** Profilfeld, das die Antwort setzt (z. B. "montage"). */
  key: string;
  label: string;
  frage: string;
  /** Antwort-Optionen (Katalog-Slug + lesbares Label). */
  optionen: { value: string; label: string }[];
}

export interface AnrufKriterium {
  key: string;
  label: string;
  /** Was der Betrieb verlangt (Soll / optimale Antwort). */
  required: string;
  /** Was der Kandidat geantwortet/im Profil hat. */
  answer: string;
  /** Erfüllungsgrad 0–1 (1 = passt vollständig). */
  fulfilment: number;
}

export interface AnrufJob {
  jobId: string;
  title: string;
  companyName: string | null;
  score: number;
  kriterien: AnrufKriterium[];
}

export interface AnrufDaten {
  profilLeer: boolean;
  topJobs: AnrufJob[];
  /** true, wenn ≥2 Top-Jobs denselben (höchsten) Score haben → KI-Zusatzfragen sinnvoll. */
  gleichstand: boolean;
  fragen: AnrufFrage[];
}

/** Breakdown-Kriterien → schlanke Anzeige-/Diff-Struktur. */
function mapKriterien(m: JobMatch): AnrufKriterium[] {
  return m.breakdown.criteria
    .filter((c) => !c.skipped)
    .map((c) => ({
      key: c.key,
      label: c.label,
      required: c.required,
      answer: c.answer,
      fulfilment: c.fulfilment,
    }));
}

/** Ist ein Kandidatenprofilfeld leer/unbekannt? */
function unbekannt(profil: Kandidatenprofil, key: string): boolean {
  const v = (profil as unknown as Record<string, unknown>)[key];
  return v == null || v === "";
}

/**
 * Baut die Anruf-Daten für einen Kandidaten: Top-3-Jobs + bis zu 3 Fragen,
 * die diese Jobs am stärksten trennen. Reines Lesen, keine Mutation.
 */
export async function anrufDatenFuer(
  applicationId: string,
  email: string,
): Promise<AnrufDaten> {
  const [user] = await sql`
    select "profileData" from public."User"
    where lower(email) = lower(${email}) and role = 'APPLICANT' limit 1`;
  if (!user) {
    return { profilLeer: true, topJobs: [], gleichstand: false, fragen: [] };
  }

  const profilObj = extractProfile(user.profileData);
  if (profilIstLeer(profilObj.profil)) {
    return { profilLeer: true, topJobs: [], gleichstand: false, fragen: [] };
  }

  const ergebnis = await rankJobsForProfile(user.profileData);
  const top = ergebnis.matches.filter((m) => !m.ohneKriterien).slice(0, 3);

  // Deterministische Auswahl: Kriterien, die (a) im Profil unbekannt sind UND
  // (b) unter den Top-Jobs verschieden gefordert werden → die trennen wirklich.
  const anforderungen = await ladeAnforderungen(top.map((j) => j.jobId));
  const kandidaten: string[] = [];
  for (const key of Object.keys(KRITERIEN)) {
    if (!unbekannt(profilObj.profil, key)) continue;
    const anfKey = key === "ausbildungsstatus" ? "ausbildungMin" : key + "Min";
    const werte = new Set(
      anforderungen
        .map((a) => a[anfKey])
        .filter((v): v is string => Boolean(v)),
    );
    // trennend, wenn mind. ein Job das fordert (bei nur einem Top-Job zählt
    // jede geforderte, unbekannte Angabe)
    if (werte.size >= 1) kandidaten.push(key);
  }
  const ausgewaehlt = kandidaten.slice(0, 3);

  const basisFragen: AnrufFrage[] = ausgewaehlt.map((key) => ({
    key,
    label: KRITERIEN[key].label,
    frage: KRITERIEN[key].frage,
    optionen: KRITERIEN[key].skala.map((o) => ({ value: o.value, label: o.label })),
  }));

  // Optionale, günstige KI-Formulierung (Stufe guenstig, gecacht) — verändert
  // nur den Fragetext, nie die Auswahl/Optionen. Fällt sauber auf Vorlagen
  // zurück, wenn kein Key vorhanden ist.
  const fragen = await formuliereFragen(basisFragen, top);

  const topJobs: AnrufJob[] = top.map((j) => ({
    jobId: j.jobId,
    title: j.title,
    companyName: j.companyName,
    score: j.breakdown.score,
    kriterien: mapKriterien(j),
  }));
  // Gleichstand: mind. zwei Top-Jobs teilen sich den höchsten (gerundeten) Score.
  const runden = topJobs.map((j) => Math.round(j.score));
  const maxScore = runden.length ? Math.max(...runden) : 0;
  const gleichstand = runden.filter((s) => s === maxScore).length >= 2;

  return { profilLeer: false, topJobs, gleichstand, fragen };
}

async function ladeAnforderungen(
  jobIds: string[],
): Promise<Record<string, string | null>[]> {
  if (jobIds.length === 0) return [];
  const rows = await sql`
    select "montageMin", "fuehrerscheinMin", "deutschMin",
           "erfahrungMin", "ausbildungMin", "startBis"
    from public."JobPosting" where id = any(${jobIds})`;
  return rows.map((r) => ({
    montageMin: (r.montageMin as string) ?? null,
    fuehrerscheinMin: (r.fuehrerscheinMin as string) ?? null,
    deutschMin: (r.deutschMin as string) ?? null,
    erfahrungMin: (r.erfahrungMin as string) ?? null,
    ausbildungMin: (r.ausbildungMin as string) ?? null,
    startBis: (r.startBis as string) ?? null,
  }));
}

const FRAGEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fragen"],
  properties: {
    fragen: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

async function formuliereFragen(
  basis: AnrufFrage[],
  top: JobMatch[],
): Promise<AnrufFrage[]> {
  if (basis.length === 0 || !kiVerfuegbar()) return basis;
  try {
    const result = await cached(
      "anruf_fragen",
      { keys: basis.map((f) => f.key), jobs: top.map((j) => j.title) },
      async () => {
        const r = await kiJson<{ fragen: string[] }>({
          feature: "anruf_fragen",
          stufe: "guenstig",
          maxTokens: 500,
          schema: FRAGEN_SCHEMA as unknown as Record<string, unknown>,
          system:
            "Du hilfst einem PORTAWERK-Mitarbeiter, der einen Handwerker anruft. " +
            "Formuliere die vorgegebenen Fragen kurz, natürlich und freundlich auf Deutsch (Du-Form), " +
            "so wie man sie am Telefon stellt. Gib GENAU so viele Fragen zurück wie hereinkommen, in gleicher Reihenfolge. " +
            "Ändere nur die Formulierung, nicht den Sinn.",
          user:
            `Kontext — die Top-Stellen dieses Kandidaten: ${top.map((j) => j.title).join(", ")}.\n` +
            `Fragen (je eine natürlich formulieren):\n` +
            basis.map((f, i) => `${i + 1}. [${f.label}] ${f.frage}`).join("\n"),
        });
        return r.ok ? r.data.fragen : basis.map((f) => f.frage);
      },
      7 * 24 * 3600,
    );
    return basis.map((f, i) => ({ ...f, frage: result[i] ?? f.frage }));
  } catch {
    return basis;
  }
}

/**
 * Wendet die Antworten (Profilfeld → Katalog-Wert) an und ranked die Top-Jobs
 * neu — komplett deterministisch, ohne KI.
 */
export async function reRankMitAntworten(
  email: string,
  jobIds: string[],
  antworten: Record<string, string>,
): Promise<AnrufJob[]> {
  const [user] = await sql`
    select "profileData" from public."User"
    where lower(email) = lower(${email}) and role = 'APPLICANT' limit 1`;
  if (!user) return [];

  const overrides: Partial<Kandidatenprofil> = {};
  for (const [key, value] of Object.entries(antworten)) {
    if (!value) continue;
    if (key in KRITERIEN && KRITERIEN[key].skala.some((o) => o.value === value)) {
      (overrides as Record<string, unknown>)[key] = value;
    }
  }

  const ergebnis = await rankJobsForProfile(user.profileData, overrides);
  const wanted = new Set(jobIds);
  return ergebnis.matches
    .filter((m) => wanted.has(m.jobId))
    .map((m) => ({
      jobId: m.jobId,
      title: m.title,
      companyName: m.companyName,
      score: m.breakdown.score,
      kriterien: mapKriterien(m),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * KI-Zusatzfragen bei Gleichstand: bekommt NUR die Unterschiede zwischen den
 * gleichauf liegenden Betrieben (Token-Doktrin — minimaler Input) und
 * entscheidet, ob weitere Fragen nötig sind, um den besten Match zu finden.
 * Deterministischer Fallback ohne KI-Key: leitet die Fragen aus den Diffs ab.
 */
export interface KiDiff {
  kriterium: string;
  /** Pro Betrieb die geforderte (optimale) Antwort. */
  betriebe: { name: string; soll: string }[];
  kandidatAntwort: string;
}
export interface KiZusatzErgebnis {
  weitereNoetig: boolean;
  begruendung: string;
  fragen: string[];
}

const ZUSATZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["weitereNoetig", "begruendung", "fragen"],
  properties: {
    weitereNoetig: { type: "boolean" },
    begruendung: { type: "string" },
    fragen: { type: "array", items: { type: "string" } },
  },
} as const;

export async function kiZusatzfragen(
  diffs: KiDiff[],
): Promise<KiZusatzErgebnis> {
  if (diffs.length === 0) {
    return {
      weitereNoetig: false,
      begruendung:
        "Die gleichauf liegenden Betriebe stellen dieselben Anforderungen — mit weiteren Fragen lässt sich der Match nicht schärfen.",
      fragen: [],
    };
  }

  // Fallback ohne KI: jede unterscheidende Anforderung wird zur Frage.
  const fallback: KiZusatzErgebnis = {
    weitereNoetig: true,
    begruendung:
      "Die Betriebe unterscheiden sich in den unten genannten Punkten — dort lohnt eine gezielte Rückfrage.",
    fragen: diffs.map((d) => `Wie ist es bei „${d.kriterium}"? (${d.betriebe.map((b) => `${b.name}: ${b.soll}`).join(" vs. ")})`),
  };
  if (!kiVerfuegbar()) return fallback;

  try {
    return await cached(
      "anruf_zusatzfragen",
      diffs,
      async () => {
        const r = await kiJson<KiZusatzErgebnis>({
          feature: "anruf_zusatzfragen",
          stufe: "guenstig",
          maxTokens: 500,
          schema: ZUSATZ_SCHEMA as unknown as Record<string, unknown>,
          system:
            "Ein PORTAWERK-Mitarbeiter telefoniert mit einem Handwerker. Mehrere Betriebe liegen gleichauf. " +
            "Dir werden NUR die Unterschiede zwischen den Betrieben gegeben. Entscheide, ob weitere kurze Fragen nötig sind, " +
            "um den besten Match zu finden, und formuliere sie knapp und natürlich auf Deutsch (Du-Form). " +
            "Wenn die Unterschiede den Kandidaten nicht betreffen oder irrelevant sind, setze weitereNoetig=false und gib keine Fragen zurück.",
          user: `Unterschiede zwischen den gleichauf liegenden Betrieben:\n${JSON.stringify(diffs)}`,
        });
        return r.ok ? r.data : fallback;
      },
      3 * 24 * 3600,
    );
  } catch {
    return fallback;
  }
}

/** Lesbares Label für eine gespeicherte Antwort. */
export function antwortLabel(key: string, value: string): string {
  const map: Record<string, string> = {
    montage: "montage",
    fuehrerschein: "fuehrerschein",
    start: "start",
    deutsch: "deutsch",
    erfahrung: "erfahrung",
    ausbildungsstatus: "ausbildung",
  };
  return labelFuer(map[key] ?? key, value);
}

export { PRIORITAETEN };
