import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { kiClient, logUsage, pruefeCacheGroesse } from "@/lib/ki";
import {
  AUSBILDUNGSSTATUS,
  BEREICHE,
  DEUTSCH,
  ERFAHRUNG,
  FUEHRERSCHEIN,
  MONTAGE,
  PRIORITAETEN,
  START,
} from "@/lib/matching/catalog";

/**
 * KI-Intake: extrahiert aus Freitext (Website-Texte, E-Mails, Notizen) ein
 * strukturiertes Unternehmensprofil + Job-Inserate im Format der Backend-API
 * (AdminCreateCompanyDto) — inklusive Rückfragen bei Lücken/Widersprüchen.
 *
 * Modell: claude-sonnet-5 mit Structured Outputs (output_config.format) —
 * bestes Preis-/Qualitätsverhältnis für strukturierte Extraktion.
 * Der Fachkatalog steht im System-Prompt (mit Cache-Breakpoint), damit die
 * Matching-Kriterien als gültige Katalog-Slugs zurückkommen.
 */

export function kiVerfuegbar(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// ── Ergebnis-Typen ──────────────────────────────────────────────────────────

export interface KiUnternehmen {
  firmenname: string | null;
  slogan: string | null;
  beschreibung: string | null;
  gruendungsjahr: string | null;
  mitarbeiter: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  website: string | null;
  kontaktName: string | null;
  kontaktPosition: string | null;
  kontaktTelefon: string | null;
  kontaktEmail: string | null;
  benefits: string[];
  montage: string | null;
  urlaubstage: string | null;
}

export interface KiJob {
  title: string;
  gewerk: string;
  description: string | null;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  montage: string | null;
  urlaubstage: number | null;
  startText: string | null;
  bereiche: string[];
  berufe: string[];
  aufgaben: string[];
  aufgabenMin: number;
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  ausbildungMin: string | null;
  montageMin: string | null;
  fuehrerscheinMin: string | null;
  deutschMin: string | null;
  gebotenes: string[];
  startBis: string | null;
}

export interface KiExtraktion {
  unternehmen: KiUnternehmen;
  jobs: KiJob[];
  /** Konkrete Fragen an den Admin, wenn Angaben fehlen oder sich widersprechen. */
  rueckfragen: string[];
  /** Annahmen/Auffälligkeiten, die der Admin kurz prüfen sollte. */
  hinweise: string[];
}

// ── JSON-Schema für Structured Outputs ──────────────────────────────────────

// Structured Outputs erlaubt max. 16 Felder mit Union-/Nullable-Typen pro
// Schema. Deshalb alle Felder als schlichte Strings (leer = nicht gefunden);
// Zahlen kommen ebenfalls als String und werden im Code geparst.
const str = { type: "string" } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;

const EXTRAKTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["unternehmen", "jobs", "rueckfragen", "hinweise"],
  properties: {
    unternehmen: {
      type: "object",
      additionalProperties: false,
      required: [
        "firmenname", "slogan", "beschreibung", "gruendungsjahr", "mitarbeiter",
        "strasse", "plz", "ort", "website", "kontaktName", "kontaktPosition",
        "kontaktTelefon", "kontaktEmail", "benefits", "montage", "urlaubstage",
      ],
      properties: {
        firmenname: str,
        slogan: str,
        beschreibung: str,
        gruendungsjahr: str,
        mitarbeiter: str,
        strasse: str,
        plz: str,
        ort: str,
        website: str,
        kontaktName: str,
        kontaktPosition: str,
        kontaktTelefon: str,
        kontaktEmail: str,
        benefits: stringArray,
        montage: str,
        urlaubstage: str,
      },
    },
    jobs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title", "gewerk", "description", "city", "salaryMin", "salaryMax",
          "montage", "urlaubstage", "startText", "bereiche", "berufe",
          "aufgaben", "aufgabenMin", "erfahrungMin", "erfahrungMax",
          "ausbildungMin", "montageMin", "fuehrerscheinMin", "deutschMin",
          "gebotenes", "startBis",
        ],
        properties: {
          title: { type: "string" },
          gewerk: { type: "string" },
          description: str,
          city: str,
          salaryMin: str,
          salaryMax: str,
          montage: str,
          urlaubstage: str,
          startText: str,
          bereiche: stringArray,
          berufe: stringArray,
          aufgaben: stringArray,
          aufgabenMin: str,
          erfahrungMin: str,
          erfahrungMax: str,
          ausbildungMin: str,
          montageMin: str,
          fuehrerscheinMin: str,
          deutschMin: str,
          gebotenes: stringArray,
          startBis: str,
        },
      },
    },
    rueckfragen: stringArray,
    hinweise: stringArray,
  },
} as const;

// ── System-Prompt (stabil → Cache-Breakpoint) ───────────────────────────────

function katalogText(): string {
  const bereiche = BEREICHE.map(
    (b) =>
      `- ${b.value} (${b.label})\n  berufe: ${b.berufe.map((x) => x.value).join(", ")}\n  aufgaben: ${b.aufgaben.map((x) => x.value).join(", ")}`,
  ).join("\n");
  const skala = (name: string, s: { value: string; label: string }[]) =>
    `${name}: ${s.map((o) => `${o.value} (${o.label})`).join(", ")}`;
  return [
    "AUSBILDUNGSBEREICHE mit ihren Berufen und Aufgabenbereichen:",
    bereiche,
    "",
    "SKALEN (nur diese Werte):",
    skala("ausbildung", AUSBILDUNGSSTATUS),
    skala("erfahrung", ERFAHRUNG),
    skala("montageMin", MONTAGE),
    skala("fuehrerschein", FUEHRERSCHEIN),
    skala("deutsch", DEUTSCH),
    skala("startBis", START),
    skala("gebotenes (Prioritäten)", PRIORITAETEN),
  ].join("\n");
}

function systemPrompt(): string {
  return `Du bist das Intake-System des internen Admin-Dashboards von Porta Werk, einer invertierten Jobbörse für Handwerker. Ein Admin fügt Freitext über einen Handwerksbetrieb ein (Website-Texte, E-Mails, Gesprächsnotizen, Stellenanzeigen — auch gemischt und unstrukturiert). Du extrahierst daraus das Unternehmensprofil und ALLE erkennbaren Job-Inserate.

REGELN:
1. Extrahiere nur, was im Text steht oder sich zweifelsfrei ergibt. Erfinde nichts. Fehlende Angaben = null bzw. leeres Array.
2. Die Matching-Felder (bereiche, berufe, aufgaben, erfahrungMin/Max, ausbildungMin, montageMin, fuehrerscheinMin, deutschMin, gebotenes, startBis) dürfen AUSSCHLIESSLICH Slugs aus dem Fachkatalog unten enthalten. Passt etwas nicht eindeutig, lass es weg und stelle eine Rückfrage. berufe/aufgaben müssen zu den gewählten bereichen gehören.
3. gewerk ist reiner Anzeigetext (z. B. "Elektronik"), fürs Matching irrelevant.
4. Gehälter: Monatsbrutto in Euro als ganze Zahl (z. B. "3.200–4.100 €" → salaryMin 3200, salaryMax 4100). Jahresgehälter in Monatswerte umrechnen (durch 12, runden) und einen Hinweis dazu schreiben. Stundenlöhne NICHT umrechnen — Rückfrage stellen.
5. aufgabenMin: fast immer 0. Nur wenn der Text ausdrücklich sagt, dass bestimmte Aufgaben zwingend abgedeckt sein müssen, entsprechend setzen — und einen Hinweis schreiben, dass das Bewerber hart ausschließt.
6. plz: nur echte 5-stellige deutsche Postleitzahlen. website: mit https:// beginnen (ergänze das Schema, wenn es fehlt).
7. RÜCKFRAGEN stellst du, wenn: der Firmenname fehlt oder mehrdeutig ist; kein Ort/keine PLZ erkennbar ist; sich Angaben widersprechen (z. B. zwei verschiedene Gehälter für denselben Job); unklar ist, ob mehrere Textabschnitte derselbe Job oder verschiedene Jobs sind; ein wichtiges Matching-Kriterium erwähnt wird, aber nicht auf den Katalog passt. Formuliere jede Rückfrage als EINE konkrete, kurz beantwortbare Frage auf Deutsch. Keine Rückfragen zu Dingen, die schlicht nicht im Text stehen und optional sind.
8. HINWEISE sind kurze Notizen zu Annahmen, die du getroffen hast (z. B. Umrechnungen, zusammengeführte Duplikate, ignorierte irrelevante Textteile).
9. Wenn der Admin Antworten auf frühere Rückfragen mitliefert, arbeite sie ein und stelle diese Fragen nicht erneut.
10. Deutsch für alle Freitexte (beschreibung, hinweise, rueckfragen).
11. Prüfe pro Job aktiv auf FEHLENDE, für das Matching WICHTIGE Angaben und stelle dazu Rückfragen, wenn sie im Text nicht vorkommen:
    - "gebotenes" (was der Betrieb bietet: Firmenwagen, Weiterbildung, hochwertiges Equipment, überdurchschnittliches Gehalt, Homeoffice-Start, Meisterstelle, Aufstieg, Personalverantwortung, Team, Urlaub, Abwechslung). Ist NICHTS davon erkennbar, frage konkret: "Was bietet der Betrieb für die Stelle „<Jobtitel>"? (z. B. Firmenwagen, Weiterbildung, Aufstiegsmöglichkeiten …)"
    - Gehalt: fehlt es, frage danach.
    - Erforderliche Berufserfahrung und Mindest-Ausbildungsstand: fehlen sie, frage kurz nach.
    Stelle nur Fragen zu Angaben, die tatsächlich fehlen — nicht zu bereits vorhandenen.

FACHKATALOG:
${katalogText()}`;
}

// ── Aufruf ──────────────────────────────────────────────────────────────────

const MAX_TEXT_LEN = 60_000;

export async function extrahiereIntake(
  text: string,
  runde2?: {
    vorherige: KiExtraktion;
    antworten: { frage: string; antwort: string }[];
  },
): Promise<
  | { ok: true; extraktion: KiExtraktion }
  | { ok: false; fehler: string }
> {
  if (!kiVerfuegbar()) {
    return {
      ok: false,
      fehler:
        "KI-Extraktion ist noch nicht aktiviert — es fehlt der ANTHROPIC_API_KEY in den Umgebungsvariablen.",
    };
  }
  const eingabe = text.trim().slice(0, MAX_TEXT_LEN);
  if (eingabe.length < 30) {
    return { ok: false, fehler: "Bitte mehr Text einfügen (mind. ein paar Sätze)." };
  }

  const client = kiClient();
  const sys = systemPrompt();
  pruefeCacheGroesse("claude-sonnet-5", sys);

  let userContent = `Eingefügter Text:\n\n<eingabe>\n${eingabe}\n</eingabe>`;
  if (runde2) {
    const beantwortet = runde2.antworten
      .filter((a) => a.antwort.trim())
      .map((a) => `Frage: ${a.frage}\nAntwort des Admins: ${a.antwort.trim()}`)
      .join("\n\n");
    userContent += `\n\nDeine bisherige Extraktion (verfeinere sie, wirf korrekte Angaben nicht weg):\n${JSON.stringify(runde2.vorherige)}\n\nAntworten des Admins auf deine Rückfragen:\n${beantwortet || "(keine Antworten gegeben)"}`;
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: sys,
          // 1h-TTL: der große, stabile Intake-Prompt wird über die mehrrundige
          // Rückfrage-Schleife hinweg (mit Denkpausen dazwischen) wiederverwendet.
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: EXTRAKTION_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [{ role: "user", content: userContent }],
    });
    await logUsage("unternehmen_intake", "claude-sonnet-5", response.usage, true, null);

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        fehler: "Die KI hat die Verarbeitung dieses Textes abgelehnt. Bitte Inhalt prüfen.",
      };
    }
    if (response.stop_reason === "max_tokens") {
      return {
        ok: false,
        fehler: "Der Text ist zu umfangreich für eine Extraktion am Stück — bitte in Teilen einfügen.",
      };
    }

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, fehler: "Leere Antwort der KI — bitte erneut versuchen." };
    }
    const roh = JSON.parse(block.text) as unknown;
    return { ok: true, extraktion: bereinige(roh) };
  } catch (err) {
    await logUsage("unternehmen_intake", "claude-sonnet-5", undefined, false, null);
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, fehler: "Der hinterlegte ANTHROPIC_API_KEY ist ungültig." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, fehler: "KI-Kontingent kurz erschöpft — bitte in einer Minute erneut versuchen." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("KI-Intake APIError", err.status, err.message);
      return { ok: false, fehler: "KI-Dienst momentan nicht erreichbar — bitte erneut versuchen." };
    }
    console.error("KI-Intake Fehler", err);
    return { ok: false, fehler: "Extraktion fehlgeschlagen — bitte erneut versuchen." };
  }
}

/**
 * Wandelt die reine String-Antwort der KI in die Zieltypen und lässt bei den
 * Matching-Feldern nur Katalog-Slugs durch (die Engine überspringt Unbekanntes
 * stumm).
 */
function bereinige(roh: unknown): KiExtraktion {
  const obj = (roh ?? {}) as Record<string, unknown>;
  const u = (obj.unternehmen ?? {}) as Record<string, unknown>;
  const rohJobs = Array.isArray(obj.jobs) ? (obj.jobs as Record<string, unknown>[]) : [];

  const s = (v: unknown): string | null => {
    const t = typeof v === "string" ? v.trim() : "";
    return t.length ? t : null;
  };
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
  const num = (v: unknown, max: number): number | null => {
    const raw = typeof v === "string" ? v.replace(/[^\d.-]/g, "") : v;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
  };

  const bereichSet = new Set(BEREICHE.map((b) => b.value));
  const berufSet = new Set(BEREICHE.flatMap((b) => b.berufe.map((x) => x.value)));
  const aufgabeSet = new Set(BEREICHE.flatMap((b) => b.aufgaben.map((x) => x.value)));
  const prioSet = new Set(PRIORITAETEN.map((p) => p.value));
  const inSkala = (skala: { value: string }[], v: unknown) => {
    const t = s(v);
    return t && skala.some((o) => o.value === t) ? t : null;
  };

  const unternehmen: KiUnternehmen = {
    firmenname: s(u.firmenname),
    slogan: s(u.slogan),
    beschreibung: s(u.beschreibung),
    gruendungsjahr: s(u.gruendungsjahr),
    mitarbeiter: s(u.mitarbeiter),
    strasse: s(u.strasse),
    plz: s(u.plz),
    ort: s(u.ort),
    website: s(u.website),
    kontaktName: s(u.kontaktName),
    kontaktPosition: s(u.kontaktPosition),
    kontaktTelefon: s(u.kontaktTelefon),
    kontaktEmail: s(u.kontaktEmail),
    benefits: arr(u.benefits).slice(0, 12),
    montage: s(u.montage),
    urlaubstage: s(u.urlaubstage),
  };

  const jobs: KiJob[] = rohJobs
    .filter((j) => s(j.title))
    .map((j) => {
      const aufgaben = arr(j.aufgaben).filter((x) => aufgabeSet.has(x));
      return {
        title: (s(j.title) ?? "").slice(0, 120),
        gewerk: s(j.gewerk) ?? "Handwerk",
        description: s(j.description),
        city: s(j.city),
        salaryMin: num(j.salaryMin, 50000),
        salaryMax: num(j.salaryMax, 50000),
        montage: s(j.montage),
        urlaubstage: num(j.urlaubstage, 60),
        startText: s(j.startText),
        bereiche: arr(j.bereiche).filter((x) => bereichSet.has(x)),
        berufe: arr(j.berufe).filter((x) => berufSet.has(x)),
        aufgaben,
        aufgabenMin: Math.max(0, Math.min(num(j.aufgabenMin, 30) ?? 0, aufgaben.length)),
        erfahrungMin: inSkala(ERFAHRUNG, j.erfahrungMin),
        erfahrungMax: inSkala(ERFAHRUNG, j.erfahrungMax),
        ausbildungMin: inSkala(AUSBILDUNGSSTATUS, j.ausbildungMin),
        montageMin: inSkala(MONTAGE, j.montageMin),
        fuehrerscheinMin: inSkala(FUEHRERSCHEIN, j.fuehrerscheinMin),
        deutschMin: inSkala(DEUTSCH, j.deutschMin),
        gebotenes: arr(j.gebotenes).filter((x) => prioSet.has(x)),
        startBis: inSkala(START, j.startBis),
      };
    });

  return {
    unternehmen,
    jobs,
    rueckfragen: arr(obj.rueckfragen).slice(0, 8),
    hinweise: arr(obj.hinweise).slice(0, 10),
  };
}
