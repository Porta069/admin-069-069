"use server";

import { getEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { kiJson, kiVerfuegbar } from "@/lib/ki";
import { rankCandidatesForJob } from "@/lib/matching/rank";
import { formatDate, formatRelative } from "@/lib/format";
import { entityHref, type EntityType } from "@/lib/definitions";

/**
 * KI-Assistent nach der Werkpair-Token-Doktrin.
 *
 * Die eigentliche Datenarbeit macht deterministischer Code (SQL + Matching-
 * Engine). Das LLM wird nur an zwei Stellen und mit kleinem Kontext benutzt:
 *   • Zusammenfassung des Kontakts mit einem Betrieb (aus gesammelten Fakten)
 *   • Entwurf einer E-Mail (Name + Anlass → {betreff, text})
 *
 * Vor JEDEM Datenzugriff wird geprüft, ob der eingeloggte Mitarbeiter das
 * betroffene Modul sehen darf. Der Assistent liefert nie Daten, die der MA
 * sonst nicht sehen würde. Jede Antwort trägt Quellen-Links.
 */

// ── Antwort-Formen ──────────────────────────────────────────────────────────

export type AntwortBlock =
  | { typ: "text"; text: string }
  | { typ: "hinweis"; text: string }
  | { typ: "liste"; leerText?: string; items: ListItem[] }
  | { typ: "email"; betreff: string; text: string }
  | { typ: "wahl"; frage: string; optionen: Quelle[] };

export interface ListItem {
  titel: string;
  href?: string;
  score?: number | null;
  meta?: string;
  sub?: string;
}

export interface Quelle {
  label: string;
  href: string;
}

export interface AssistantAntwort {
  /** Erkannte Absicht (für Debug/Transparenz). */
  intent: string;
  /** Kurze, deterministische Einleitung. */
  einleitung: string;
  bloecke: AntwortBlock[];
  quellen: Quelle[];
  /** true → ein „schön formulierter" Teil fehlt, weil kein KI-Key gesetzt ist. */
  kiHinweis?: boolean;
}

// ── Textwerkzeuge ───────────────────────────────────────────────────────────

const STOPWORTE = new Set([
  "welche",
  "welcher",
  "welchen",
  "kandidat",
  "kandidaten",
  "handwerker",
  "bewerber",
  "passen",
  "passt",
  "passende",
  "zum",
  "zur",
  "für",
  "fuer",
  "job",
  "jobs",
  "stelle",
  "stellen",
  "position",
  "inserat",
  "die",
  "der",
  "das",
  "den",
  "dem",
  "ein",
  "eine",
  "einen",
  "und",
  "oder",
  "mit",
  "von",
  "vom",
  "bei",
  "beim",
  "betrieb",
  "unternehmen",
  "firma",
  "kontakt",
  "fasse",
  "zusammen",
  "zusammenfassung",
  "überblick",
  "ueberblick",
  "verlauf",
  "historie",
  "entwirf",
  "entwerfe",
  "schreibe",
  "schreib",
  "verfasse",
  "email",
  "e-mail",
  "mail",
  "anschreiben",
  "eine",
  "diese",
  "woche",
  "muss",
  "ich",
  "soll",
  "kontaktieren",
  "wen",
  "top",
  "an",
  "in",
  "im",
  "zu",
  "auf",
  "was",
  "wie",
  "ist",
]);

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Aussagekräftige Suchbegriffe aus der Frage (Stopwörter/Kurzwörter raus). */
function tokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/["„""'?!.,;:]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !STOPWORTE.has(t)),
    ),
  ).slice(0, 6);
}

/** Text in Anführungszeichen bevorzugt als expliziter Suchbegriff. */
function zitat(text: string): string | null {
  const m = text.match(/["„'']([^"""']{2,})["""']/);
  return m ? m[1].trim() : null;
}

type Intent =
  | "kandidaten_fuer_job"
  | "kontakt_woche"
  | "betrieb_zusammenfassung"
  | "email_entwurf"
  | "unbekannt";

/** Regelbasierte Absichtserkennung — kostenlos, funktioniert ohne KI-Key. */
function erkenneIntent(frageRaw: string): Intent {
  const q = frageRaw.toLowerCase();
  const hatMail = /(e-?mail|mail|anschreiben)/.test(q);
  const hatEntwurf = /(entwirf|entwerf|schreib|verfass|formulier|aufsetz|text)/.test(q);
  if (hatMail && hatEntwurf) return "email_entwurf";

  const hatFassen = /(fasse|zusammenfass|zusammenfassung|überblick|ueberblick|verlauf|historie)/.test(q);
  const hatBetrieb = /(betrieb|unternehmen|firma)/.test(q);
  if (hatFassen && hatBetrieb) return "betrieb_zusammenfassung";

  if (/(diese woche|kontaktieren|nachfassen|wiedervorlage|anrufen|to-?do|aufgaben)/.test(q))
    return "kontakt_woche";

  const hatKandidat = /(kandidat|handwerker|bewerber)/.test(q);
  const hatJob = /(job|stelle|position|inserat)/.test(q);
  if (hatKandidat && hatJob) return "kandidaten_fuer_job";
  if (/passen|passende|matches?|treffer/.test(q) && hatJob) return "kandidaten_fuer_job";

  return "unbekannt";
}

function keineBerechtigung(intent: string, modulLabel: string): AssistantAntwort {
  return {
    intent,
    einleitung: `Dafür fehlt dir die Berechtigung für das Modul „${modulLabel}".`,
    bloecke: [
      {
        typ: "hinweis",
        text: "Der Assistent zeigt nur Daten, die du auch sonst im Dashboard sehen darfst.",
      },
    ],
    quellen: [],
  };
}

// ── Einstieg ────────────────────────────────────────────────────────────────

export async function frageAssistent(frageRaw: string): Promise<AssistantAntwort> {
  const employee = await getEmployee();
  if (!employee) throw new Error("Nicht angemeldet.");

  const frage = (frageRaw ?? "").trim().slice(0, 500);
  if (!frage) {
    return hilfeAntwort("unbekannt");
  }

  try {
    const intent = erkenneIntent(frage);
    switch (intent) {
      case "kandidaten_fuer_job":
        return await kandidatenFuerJob(frage, employee);
      case "kontakt_woche":
        return await kontaktWoche(frage, employee);
      case "betrieb_zusammenfassung":
        return await betriebZusammenfassung(frage, employee);
      case "email_entwurf":
        return await emailEntwurf(frage, employee);
      default:
        return hilfeAntwort("unbekannt");
    }
  } catch (e) {
    console.error("frageAssistent failed", e);
    return {
      intent: "fehler",
      einleitung: "Da ist leider etwas schiefgelaufen.",
      bloecke: [
        {
          typ: "hinweis",
          text: "Bitte formuliere die Frage etwas anders oder versuche es gleich erneut.",
        },
      ],
      quellen: [],
    };
  }
}

// ── Intent: Kandidaten für einen Job (deterministisch, kein LLM) ────────────

type EmployeeCtx = Awaited<ReturnType<typeof getEmployee>> & object;

async function findeJob(
  frage: string,
): Promise<{ id: string; title: string; company: string | null } | null> {
  const uuid = frage.match(UUID_RE)?.[0];
  if (uuid) {
    const [j] = await sql`
      select j.id, j.title, c.name as company
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.id = ${uuid} limit 1`;
    if (j) return { id: j.id as string, title: j.title as string, company: (j.company as string) ?? null };
  }

  const z = zitat(frage);
  const toks = z ? [z.toLowerCase()] : tokens(frage);
  if (toks.length === 0) return null;

  let where = sql`j.title ilike ${"%" + toks[0] + "%"}`;
  for (let i = 1; i < toks.length; i++) {
    where = sql`${where} or j.title ilike ${"%" + toks[i] + "%"}`;
  }
  const rows = await sql`
    select j.id, j.title, j.city, c.name as company
    from public."JobPosting" j
    left join public."Company" c on c.id = j."companyId"
    where j.status = 'ACTIVE' and (${where})
    order by j."createdAt" desc
    limit 8`;
  if (rows.length === 0) return null;

  // Besten Treffer nach Anzahl übereinstimmender Tokens wählen.
  const scored = rows
    .map((r) => {
      const t = (r.title as string).toLowerCase();
      const hits = toks.filter((tok) => t.includes(tok)).length;
      return { r, hits };
    })
    .sort((a, b) => b.hits - a.hits);
  const best = scored[0].r;
  return {
    id: best.id as string,
    title: best.title as string,
    company: (best.company as string) ?? null,
  };
}

async function kandidatenFuerJob(
  frage: string,
  employee: EmployeeCtx,
): Promise<AssistantAntwort> {
  if (!can(employee, "jobs", "view")) return keineBerechtigung("kandidaten_fuer_job", "Stellen");
  if (!can(employee, "candidates", "view"))
    return keineBerechtigung("kandidaten_fuer_job", "Kandidaten");

  const job = await findeJob(frage);
  if (!job) {
    return {
      intent: "kandidaten_fuer_job",
      einleitung:
        "Ich konnte keine passende aktive Stelle finden. Nenne den Stellentitel möglichst genau oder gib die Stellen-ID an.",
      bloecke: [
        {
          typ: "hinweis",
          text: 'Beispiel: „Welche Kandidaten passen zu Job Elektriker München?"',
        },
      ],
      quellen: [],
    };
  }

  const ergebnis = await rankCandidatesForJob(job.id);
  if (!ergebnis) {
    return {
      intent: "kandidaten_fuer_job",
      einleitung: `Die Stelle „${job.title}" wurde nicht gefunden.`,
      bloecke: [],
      quellen: [{ label: `Stelle: ${job.title}`, href: entityHref("job", job.id) }],
    };
  }

  const top = ergebnis.bewertet.slice(0, 10);
  const items: ListItem[] = top.map((c) => ({
    titel: c.name,
    href: entityHref("candidate", c.applicationId),
    score: c.ohneKriterien ? null : Math.round(c.breakdown.score),
    meta: [c.profession, c.federalState].filter(Boolean).join(" · ") || undefined,
    sub: c.ohneKriterien ? "Keine bewertbaren Kriterien" : undefined,
  }));

  const bloecke: AntwortBlock[] = [
    {
      typ: "liste",
      leerText: "Aktuell passt kein Kandidat ohne Ausschluss auf diese Stelle.",
      items,
    },
  ];

  const rausGesamt = ergebnis.ausgeschlossen.length;
  const ohneProfil = ergebnis.ohneProfil.length;
  if (rausGesamt > 0 || ohneProfil > 0) {
    const teile: string[] = [];
    if (rausGesamt > 0) teile.push(`${rausGesamt} durch Ausschlusskriterien ausgeblendet`);
    if (ohneProfil > 0) teile.push(`${ohneProfil} ohne verwertbares Matching-Profil`);
    bloecke.push({
      typ: "hinweis",
      text: `Nicht gezeigt: ${teile.join(", ")}. Die Zahlen sind der Engine-Basis-Score (ohne persönliche Absage-Historie).`,
    });
  }

  const einleitung =
    top.length > 0
      ? `Die ${top.length} bestpassenden Kandidaten für „${job.title}"${job.company ? ` (${job.company})` : ""}, sortiert nach Match-Score:`
      : `Für „${job.title}" gibt es aktuell keine passenden Kandidaten.`;

  return {
    intent: "kandidaten_fuer_job",
    einleitung,
    bloecke,
    quellen: [{ label: `Stelle: ${job.title}`, href: entityHref("job", job.id) }],
  };
}

// ── Intent: Wen diese Woche kontaktieren (deterministisch, kein LLM) ────────

async function kontaktWoche(
  _frage: string,
  employee: EmployeeCtx,
): Promise<AssistantAntwort> {
  const darfAufgaben = can(employee, "tasks", "view");
  const darfKandidaten = can(employee, "candidates", "view");
  if (!darfAufgaben && !darfKandidaten)
    return keineBerechtigung("kontakt_woche", "Aufgaben");

  const bloecke: AntwortBlock[] = [];
  const quellen: Quelle[] = [{ label: "Alle Aufgaben", href: "/aufgaben" }];

  if (darfAufgaben) {
    const aufgaben = await sql`
      select id, title, due_at, priority, status, entity_type, entity_id
      from admin.task
      where deleted_at is null
        and assignee_id = ${employee.id}
        and status in ('OPEN', 'IN_PROGRESS')
        and (due_at is null or due_at <= now() + interval '7 days')
      order by (due_at is null) asc, due_at asc
      limit 15`;

    const items: ListItem[] = aufgaben.map((t) => {
      const due = t.due_at as string | null;
      const ueberfaellig = due ? new Date(due).getTime() < Date.now() : false;
      return {
        titel: t.title as string,
        href:
          t.entity_type && t.entity_id
            ? entityHref(t.entity_type as EntityType, t.entity_id as string)
            : "/aufgaben",
        meta: due
          ? `${ueberfaellig ? "überfällig · " : "fällig "}${formatDate(due)}`
          : "ohne Frist",
        sub: (t.priority as string) === "DRINGEND" ? "Dringend" : undefined,
      };
    });

    bloecke.push({
      typ: "text",
      text: "Deine offenen und fälligen Aufgaben (nächste 7 Tage):",
    });
    bloecke.push({
      typ: "liste",
      leerText: "Keine offenen Aufgaben mit Frist in den nächsten 7 Tagen — sauber.",
      items,
    });
  }

  if (darfKandidaten) {
    const reaktivierung = await sql`
      select a.id, a."firstName", a."lastName", a.profession, a."updatedAt",
             cm.status as pipeline, cm.verfuegbar_bestaetigt_am
      from admin.candidate a
      left join admin.candidate_meta cm on cm.application_id = a.id
      where a.status <> 'ERASED'
        and a."updatedAt" < now() - interval '30 days'
        and coalesce(cm.status, 'NEU') not in ('ANGENOMMEN', 'ABGELEHNT', 'KEIN_INTERESSE', 'INAKTIV')
      order by a."updatedAt" asc
      limit 6`;

    const items: ListItem[] = reaktivierung.map((c) => ({
      titel: `${c.firstName} ${c.lastName}`,
      href: entityHref("candidate", c.id as string),
      meta: (c.profession as string) ?? undefined,
      sub: `zuletzt aktiv ${formatRelative(c.updatedAt as string)}`,
    }));

    if (items.length > 0) {
      bloecke.push({
        typ: "text",
        text: "Reaktivierung — länger als 30 Tage keine Bewegung, aber grundsätzlich vermittelbar:",
      });
      bloecke.push({ typ: "liste", items });
      quellen.push({ label: "Reaktivierung", href: "/kandidaten?tab=reaktivierung" });
    }
  }

  return {
    intent: "kontakt_woche",
    einleitung: "Das steht diese Woche an:",
    bloecke,
    quellen,
  };
}

// ── Intent: Kontakt mit Betrieb zusammenfassen (LLM: guenstig, klein) ───────

async function findeCompany(
  frage: string,
): Promise<{ id: string; name: string } | null> {
  const uuid = frage.match(UUID_RE)?.[0];
  if (uuid) {
    const [c] = await sql`select id, name from public."Company" where id = ${uuid} limit 1`;
    if (c) return { id: c.id as string, name: c.name as string };
  }
  const z = zitat(frage);
  const toks = z ? [z.toLowerCase()] : tokens(frage);
  if (toks.length === 0) return null;

  let where = sql`name ilike ${"%" + toks[0] + "%"}`;
  for (let i = 1; i < toks.length; i++) {
    where = sql`${where} or name ilike ${"%" + toks[i] + "%"}`;
  }
  const rows = await sql`
    select id, name from public."Company"
    where ${where}
    order by "createdAt" desc
    limit 8`;
  if (rows.length === 0) return null;

  const scored = rows
    .map((r) => {
      const n = (r.name as string).toLowerCase();
      return { r, hits: toks.filter((t) => n.includes(t)).length };
    })
    .sort((a, b) => b.hits - a.hits);
  return { id: scored[0].r.id as string, name: scored[0].r.name as string };
}

async function betriebZusammenfassung(
  frage: string,
  employee: EmployeeCtx,
): Promise<AssistantAntwort> {
  if (!can(employee, "companies", "view"))
    return keineBerechtigung("betrieb_zusammenfassung", "Unternehmen");

  const company = await findeCompany(frage);
  if (!company) {
    return {
      intent: "betrieb_zusammenfassung",
      einleitung: "Ich konnte kein passendes Unternehmen finden.",
      bloecke: [
        {
          typ: "hinweis",
          text: 'Nenne den Firmennamen möglichst genau, z. B. „Fasse den Kontakt mit Betrieb Müller GmbH zusammen".',
        },
      ],
      quellen: [],
    };
  }

  // Deterministisch: die Fakten aus dem Admin-Bereich einsammeln (klein halten).
  const [notizen, komm, termine, placements] = await Promise.all([
    sql`select content, category, created_at from admin.note
        where deleted_at is null and entity_type = 'company' and entity_id = ${company.id}
        order by created_at desc limit 6`,
    sql`select channel, direction, subject, occurred_at from admin.communication
        where deleted_at is null and entity_type = 'company' and entity_id = ${company.id}
        order by occurred_at desc limit 6`,
    sql`select title, starts_at, status from admin.appointment
        where deleted_at is null and entity_type = 'company' and entity_id = ${company.id}
        order by starts_at desc limit 4`,
    sql`select candidate_name, job_title, status, placed_at from admin.placement
        where deleted_at is null and company_id = ${company.id}
        order by placed_at desc limit 4`,
  ]);

  const fakten: string[] = [];
  for (const k of komm)
    fakten.push(
      `${formatDate(k.occurred_at as string)}: ${k.direction === "INBOUND" ? "eingehend" : "ausgehend"} ${k.channel} – ${(k.subject as string) || "ohne Betreff"}`,
    );
  for (const n of notizen)
    fakten.push(
      `${formatDate(n.created_at as string)}: Notiz${n.category ? ` (${n.category})` : ""} – ${String(n.content).slice(0, 160)}`,
    );
  for (const t of termine)
    fakten.push(`${formatDate(t.starts_at as string)}: Termin „${t.title}" (${t.status})`);
  for (const p of placements)
    fakten.push(
      `${formatDate(p.placed_at as string)}: Vermittlung ${p.candidate_name}${p.job_title ? ` als ${p.job_title}` : ""} (${p.status})`,
    );

  const quellen: Quelle[] = [
    { label: `Unternehmen: ${company.name}`, href: entityHref("company", company.id) },
  ];

  if (fakten.length === 0) {
    return {
      intent: "betrieb_zusammenfassung",
      einleitung: `Zu „${company.name}" liegen noch keine Notizen, Kommunikation, Termine oder Vermittlungen vor.`,
      bloecke: [
        { typ: "hinweis", text: "Sobald Kontakt dokumentiert ist, kann ich ihn zusammenfassen." },
      ],
      quellen,
    };
  }

  const faktenListe: ListItem[] = fakten.map((f) => ({ titel: f }));

  // Nur die FORMULIERUNG geht ans LLM — mit kleinem Kontext (die Fakten selbst).
  if (kiVerfuegbar()) {
    const res = await kiJson<{ zusammenfassung: string }>({
      feature: "assistent.betrieb_zusammenfassung",
      stufe: "guenstig",
      system:
        "Du bist der interne Assistent von Werkpair (Vermittlung von Handwerkern an Betriebe). " +
        "Fasse den bisherigen Kontakt mit einem Betrieb aus den gelieferten Fakten in 2–4 nüchternen deutschen Sätzen zusammen. " +
        "Erfinde nichts, nutze nur die Fakten. Nenne den aktuellen Stand und einen sinnvollen nächsten Schritt.",
      user: `Betrieb: ${company.name}\nFakten (neueste zuerst):\n- ${fakten.join("\n- ")}`,
      schema: {
        type: "object",
        properties: { zusammenfassung: { type: "string" } },
        required: ["zusammenfassung"],
        additionalProperties: false,
      },
      maxTokens: 400,
      actorId: employee.id,
    });

    if (res.ok) {
      return {
        intent: "betrieb_zusammenfassung",
        einleitung: `Kontakt mit „${company.name}":`,
        bloecke: [
          { typ: "text", text: res.data.zusammenfassung },
          { typ: "liste", items: faktenListe },
        ],
        quellen,
      };
    }
  }

  // Ohne KI (oder bei KI-Fehler): die Fakten als Bulletpoints, dezenter Hinweis.
  return {
    intent: "betrieb_zusammenfassung",
    einleitung: `Kontakt mit „${company.name}" — die dokumentierten Fakten:`,
    bloecke: [{ typ: "liste", items: faktenListe }],
    quellen,
    kiHinweis: true,
  };
}

// ── Intent: E-Mail an Kandidat entwerfen (LLM: guenstig, Structured) ────────

async function findeKandidat(
  frage: string,
): Promise<{ id: string; name: string } | null> {
  const uuid = frage.match(UUID_RE)?.[0];
  if (uuid) {
    const [a] = await sql`
      select id, "firstName" || ' ' || "lastName" as name
      from admin.candidate where id = ${uuid} and status <> 'ERASED' limit 1`;
    if (a) return { id: a.id as string, name: a.name as string };
  }
  const z = zitat(frage);
  const toks = z ? z.toLowerCase().split(/\s+/) : tokens(frage);
  if (toks.length === 0) return null;

  let where = sql`(a."firstName" || ' ' || a."lastName") ilike ${"%" + toks[0] + "%"}`;
  for (let i = 1; i < toks.length; i++) {
    where = sql`${where} or (a."firstName" || ' ' || a."lastName") ilike ${"%" + toks[i] + "%"}`;
  }
  const rows = await sql`
    select a.id, a."firstName" || ' ' || a."lastName" as name
    from admin.candidate a
    where a.status <> 'ERASED' and (${where})
    order by a."createdAt" desc
    limit 8`;
  if (rows.length === 0) return null;

  const scored = rows
    .map((r) => {
      const n = (r.name as string).toLowerCase();
      return { r, hits: toks.filter((t) => t.length >= 3 && n.includes(t)).length };
    })
    .sort((a, b) => b.hits - a.hits);
  return { id: scored[0].r.id as string, name: scored[0].r.name as string };
}

/** Anlass = die Frage ohne die „E-Mail an X"-Hülle. */
function anlassAus(frage: string, name: string): string {
  let rest = frage
    .replace(new RegExp(name, "i"), " ")
    .replace(/e-?mail|mail|anschreiben|entwirf|entwerfe|schreib(e)?|verfasse?|an kandidat(en)?|an|für|fuer/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (rest.length < 4) rest = "allgemeine Kontaktaufnahme / nächster Schritt in der Vermittlung";
  return rest.slice(0, 200);
}

async function emailEntwurf(
  frage: string,
  employee: EmployeeCtx,
): Promise<AssistantAntwort> {
  if (!can(employee, "candidates", "view"))
    return keineBerechtigung("email_entwurf", "Kandidaten");

  const kandidat = await findeKandidat(frage);
  if (!kandidat) {
    return {
      intent: "email_entwurf",
      einleitung: "Für welchen Kandidaten soll die E-Mail sein? Ich konnte keinen finden.",
      bloecke: [
        {
          typ: "hinweis",
          text: 'Beispiel: „Entwirf eine E-Mail an Kandidat Max Mustermann wegen Interviewtermin".',
        },
      ],
      quellen: [],
    };
  }

  const quellen: Quelle[] = [
    { label: `Kandidat: ${kandidat.name}`, href: entityHref("candidate", kandidat.id) },
  ];
  const anlass = anlassAus(frage, kandidat.name);

  if (!kiVerfuegbar()) {
    return {
      intent: "email_entwurf",
      einleitung: `E-Mail an ${kandidat.name}:`,
      bloecke: [
        {
          typ: "hinweis",
          text: "Der KI-Provider ist nicht verbunden (ANTHROPIC_API_KEY fehlt) — den formulierten Entwurf gibt es erst nach dem Verbinden. Anlass: " +
            anlass,
        },
      ],
      quellen,
      kiHinweis: true,
    };
  }

  const res = await kiJson<{ betreff: string; text: string }>({
    feature: "assistent.email_entwurf",
    stufe: "guenstig",
    system:
      "Du entwirfst kurze, freundliche und professionelle E-Mails auf Deutsch im Namen des Vermittlungsteams von Werkpair (vermittelt Handwerker an Betriebe). " +
      "Sprich den Empfänger höflich mit Sie an. Halte dich knapp und konkret, keine Floskeln, kein Fließtext über 120 Wörter. " +
      "Gib einen prägnanten Betreff und den E-Mail-Text (mit Anrede und Grußformel 'Mit freundlichen Grüßen, Ihr Werkpair-Team').",
    user: `Empfänger (Kandidat): ${kandidat.name}\nAnlass der E-Mail: ${anlass}`,
    schema: {
      type: "object",
      properties: { betreff: { type: "string" }, text: { type: "string" } },
      required: ["betreff", "text"],
      additionalProperties: false,
    },
    maxTokens: 600,
    actorId: employee.id,
  });

  if (!res.ok) {
    return {
      intent: "email_entwurf",
      einleitung: `E-Mail an ${kandidat.name}:`,
      bloecke: [{ typ: "hinweis", text: res.fehler }],
      quellen,
      kiHinweis: true,
    };
  }

  return {
    intent: "email_entwurf",
    einleitung: `Entwurf für eine E-Mail an ${kandidat.name}:`,
    bloecke: [{ typ: "email", betreff: res.data.betreff, text: res.data.text }],
    quellen,
  };
}

// ── Fallback / Hilfe ────────────────────────────────────────────────────────

function hilfeAntwort(intent: string): AssistantAntwort {
  return {
    intent,
    einleitung: "Das habe ich nicht sicher verstanden. Ich kann dir bei diesen Dingen helfen:",
    bloecke: [
      {
        typ: "liste",
        items: [
          { titel: "Welche 10 Kandidaten passen zu Job …?", sub: "Match-Liste aus der Engine" },
          { titel: "Welche Kandidaten muss ich diese Woche kontaktieren?", sub: "Aufgaben + Reaktivierung" },
          { titel: "Fasse den Kontakt mit Betrieb … zusammen", sub: "Verlauf aus dem CRM" },
          { titel: "Entwirf eine E-Mail an Kandidat … wegen …", sub: "Betreff + Text" },
        ],
      },
    ],
    quellen: [],
  };
}
