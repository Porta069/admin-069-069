import "server-only";

/**
 * Sammelt ALLE weiteren Registrierungs-Antworten eines Kandidaten, die nicht
 * bereits Teil des Kern-Profils sind (`profilAnzeige` deckt bereich/beruf/…,
 * Aufgaben, Prioritäten & Arbeitsorte ab). Damit im Dashboard und im Callcenter
 * wirklich sichtbar wird, wie der Kandidat JEDE Frage beantwortet hat — inkl.
 * Freitext, Survey- und KI-Fragebogen. Unbekannte Schlüssel werden lesbar
 * gemacht statt verschwiegen (keine Antwort geht verloren).
 */

export interface ZusatzAntwort {
  label: string;
  werte: string[];
}

// Kern-Profilfelder (werden separat über profilAnzeige gezeigt) → hier ausblenden.
const KERN_KEYS = new Set([
  "bereich", "beruf", "ausbildungsstatus", "aufgaben", "erfahrung",
  "prioritaeten", "montage", "fuehrerschein", "deutsch", "start",
  "workLocations", "profil", "skipped",
]);

// Sprechende Labels für die Survey-/KI-Fragen.
const FRAGE_LABEL: Record<string, string> = {
  survey_ziel: "Ziel bei der Jobsuche",
  survey_umfeld: "Bevorzugtes Arbeitsumfeld",
  survey_bereitschaft: "Bereitschaft",
  survey_wechsel: "Wechselbereitschaft",
  ai_gewerke: "Gewerke",
  ai_staerken: "Stärken",
  ai_erfahrung: "Berufserfahrung (Jahre)",
  ai_auftragsart: "Auftragsart",
  ai_zertifikate: "Zertifikate & Abschlüsse",
  ai_taetigkeiten: "Tätigkeiten",
};

// Sprechende Werte (Slug → Klartext) für bekannte Antworten.
const WERT_LABEL: Record<string, string> = {
  // survey_ziel
  gehalt: "Höheres Gehalt",
  naehe: "Nähe zum Wohnort",
  aufstieg: "Aufstiegsmöglichkeiten",
  sicherheit: "Sichere Anstellung",
  team: "Gutes Team",
  worklife: "Work-Life-Balance",
  // survey_umfeld
  klein: "Kleiner Betrieb",
  mittel: "Mittelständisch",
  gross: "Großes Unternehmen",
  egal: "Egal",
  // survey_bereitschaft
  montage: "Montagebereitschaft",
  schicht: "Schichtarbeit",
  reise: "Reisebereitschaft",
  wochenende: "Wochenendarbeit",
  // ai_auftragsart
  privat: "Privatkunden",
  gewerblich: "Gewerbekunden",
  industrie: "Industrie",
  beides: "Beides",
  // ai_zertifikate
  geselle: "Geselle",
  meister: "Meister",
  techniker: "Techniker",
  fuehrerschein: "Führerschein",
};

function humanize(s: string): string {
  const clean = s.replace(/^(survey_|ai_)/, "").replace(/[_-]+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function labelFuerFrage(key: string): string {
  return FRAGE_LABEL[key] ?? humanize(key);
}

function wertLabel(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "-") return null;
    return WERT_LABEL[t] ?? t;
  }
  return null;
}

/** Sammelt Antwort-Objekte (answers/surveyAnswers/aiAnswers) rekursiv ein. */
function sammleAntworten(node: unknown, out: Map<string, unknown>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "answers" || k === "surveyAnswers" || k === "aiAnswers") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [ak, av] of Object.entries(v as Record<string, unknown>)) {
          if (!out.has(ak)) out.set(ak, av);
        }
      }
      continue;
    }
    if (k.startsWith("survey_") || k.startsWith("ai_")) {
      if (!out.has(k)) out.set(k, v);
      continue;
    }
    // Tiefer suchen (Schritt-Objekte wie "1", "4" …), aber Kern-Profil überspringen.
    if (k === "profil") continue;
    if (v && typeof v === "object") sammleAntworten(v, out);
  }
}

export function zusatzAntworten(profileData: unknown): ZusatzAntwort[] {
  const roh = new Map<string, unknown>();
  sammleAntworten(profileData, roh);

  const out: ZusatzAntwort[] = [];
  for (const [key, value] of roh) {
    if (KERN_KEYS.has(key)) continue;
    let werte: string[];
    if (Array.isArray(value)) {
      werte = value.map(wertLabel).filter((x): x is string => Boolean(x));
    } else {
      const w = wertLabel(value);
      werte = w ? [w] : [];
    }
    if (werte.length === 0) continue;
    out.push({ label: labelFuerFrage(key), werte });
  }
  return out;
}
