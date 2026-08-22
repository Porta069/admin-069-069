import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { sql } from "@/lib/db";
import { rankCandidatesForJob, rankJobsForProfile } from "@/lib/matching/rank";

/**
 * MCP-Server des Admin-Dashboards (Remote, Streamable HTTP).
 *
 * Endpunkt:  /api/mcp
 * Auth:      Secret-Token — `Authorization: Bearer <MCP_SECRET>` ODER `?key=<MCP_SECRET>`
 *            (Query-Variante für claude.ai-Connectoren, die keine Header setzen können).
 *
 * Der Token gewährt VOLLEN Admin-Zugriff (liest alles, schreibt Aufgaben/Notizen)
 * und ist entsprechend geheim zu halten. Ohne gesetztes MCP_SECRET ist der
 * Endpunkt komplett deaktiviert.
 */

export const maxDuration = 120;

const LIMIT_DEFAULT = 25;
const LIMIT_MAX = 200;

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fehler(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ fehler: message }) }],
    isError: true,
  };
}

function begrenze(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);
}

/** Nur-Lese-Guard für freie SQL-Abfragen. Gibt Fehlertext oder null zurück. */
function pruefeReadonlySql(q: string): string | null {
  const s = q.trim();
  if (s.includes(";")) return "Nur eine einzelne Abfrage ohne Semikolon erlaubt.";
  if (!/^(select|with)\b/i.test(s)) return "Nur SELECT-/WITH-Abfragen erlaubt.";
  if (
    /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|vacuum|call|do|set|reset|listen|notify|refresh|comment|security|import|reindex)\b/i.test(
      s,
    )
  ) {
    return "Nur lesende Abfragen erlaubt (kein DML/DDL).";
  }
  return null;
}

const handler = createMcpHandler(
  (server) => {
    // ── Überblick ──────────────────────────────────────────────────────
    server.registerTool(
      "dashboard_uebersicht",
      {
        description:
          "Gesamtüberblick des Admin-Dashboards: Kennzahlen zu Kandidaten, Unternehmen, Stellen, Aufgaben, Vermittlungen, Rechnungen und Auszahlungen.",
      },
      async () => {
        const [row] = await sql`
          select
            (select count(*)::int from admin.candidate where status <> 'ERASED') as kandidaten,
            (select count(*)::int from public."Company") as unternehmen,
            (select count(*)::int from public."JobPosting" where status <> 'ARCHIVED') as stellen,
            (select count(*)::int from admin.task where status = 'OPEN' and deleted_at is null) as offene_aufgaben,
            (select count(*)::int from admin.placement) as vermittlungen,
            (select count(*)::int from admin.invoice where deleted_at is null) as rechnungen,
            (select count(*)::int from admin.payout where deleted_at is null and status = 'OFFEN') as offene_auszahlungen,
            (select count(*)::int from admin.employee where deleted_at is null) as mitarbeiter`;
        return ok(row);
      },
    );

    // ── Kandidaten ─────────────────────────────────────────────────────
    server.registerTool(
      "kandidaten_suchen",
      {
        description:
          "Kandidaten suchen (Name, E-Mail, Telefon, Beruf). Liefert id, Name, Kontakt, Beruf, Status, Bundesland.",
        inputSchema: z.object({
          suche: z.string().optional().describe("Suchtext (Name/E-Mail/Telefon/Beruf)"),
          status: z.string().optional().describe("Status-Filter, z. B. NEW/ACTIVE"),
          limit: z.number().int().optional(),
        }),
      },
      async ({ suche, status, limit }) => {
        const like = `%${suche ?? ""}%`;
        const rows = await sql`
          select id, "firstName" || ' ' || "lastName" as name, email, phone,
                 profession, status, "federalState" as bundesland, "createdAt" as registriert
          from admin.candidate
          where status <> 'ERASED'
            ${suche ? sql`and ("firstName" || ' ' || "lastName" ilike ${like} or email ilike ${like} or coalesce(phone,'') ilike ${like} or coalesce(profession,'') ilike ${like})` : sql``}
            ${status ? sql`and status = ${status}` : sql``}
          order by "createdAt" desc
          limit ${begrenze(limit)}`;
        return ok(rows);
      },
    );

    server.registerTool(
      "kandidat_details",
      {
        description:
          "Alle Details eines Kandidaten: Stammdaten, komplettes Registrierungs-/Matching-Profil (profileData), Notizen, Aufgaben und Anruf-Historie.",
        inputSchema: z.object({
          id: z.string().describe("Kandidaten-ID (admin.candidate.id)"),
        }),
      },
      async ({ id }) => {
        const [kandidat] = await sql`
          select * from admin.candidate where id = ${id} limit 1`;
        if (!kandidat) return fehler("Kandidat nicht gefunden.");
        const [user] = await sql`
          select "profileData" from public."User"
          where lower(email) = lower(${kandidat.email as string}) and role = 'APPLICANT' limit 1`;
        const notizen = await sql`
          select n.content, n.category, n.created_at, e.name as autor
          from admin.note n left join admin.employee e on e.id = n.author_id
          where n.entity_type = 'candidate' and n.entity_id = ${id} and n.deleted_at is null
          order by n.created_at desc limit 20`;
        const aufgaben = await sql`
          select title, status, priority, due_at from admin.task
          where entity_type = 'candidate' and entity_id = ${id} and deleted_at is null
          order by created_at desc limit 20`;
        const anrufe = await sql`
          select cs.created_at, cs.status, cs.ergebnis, cs.notiz, e.name as mitarbeiter
          from admin.call_session cs left join admin.employee e on e.id = cs.employee_id
          where cs.application_id = ${id} and cs.deleted_at is null
          order by cs.created_at desc limit 20`;
        return ok({ kandidat, matchingProfil: user?.profileData ?? null, notizen, aufgaben, anrufe });
      },
    );

    // ── Unternehmen & Stellen ──────────────────────────────────────────
    server.registerTool(
      "unternehmen_suchen",
      {
        description:
          "Unternehmen suchen (Name, Ort, Ansprechpartner). Liefert id, Name, Ort, Kontakt und Anzahl aktiver Stellen.",
        inputSchema: z.object({
          suche: z.string().optional(),
          limit: z.number().int().optional(),
        }),
      },
      async ({ suche, limit }) => {
        const like = `%${suche ?? ""}%`;
        const rows = await sql`
          select c.id, c.name, c.ort, c."kontaktName" as kontakt, c."createdAt" as angelegt,
                 (select count(*)::int from public."JobPosting" j
                    where j."companyId" = c.id and j.status <> 'ARCHIVED') as aktive_stellen
          from public."Company" c
          ${suche ? sql`where c.name ilike ${like} or coalesce(c.ort,'') ilike ${like} or coalesce(c."kontaktName",'') ilike ${like}` : sql``}
          order by c."createdAt" desc
          limit ${begrenze(limit)}`;
        return ok(rows);
      },
    );

    server.registerTool(
      "unternehmen_details",
      {
        description: "Details eines Unternehmens inkl. aller Stellen und Notizen.",
        inputSchema: z.object({
          id: z.string().describe("Unternehmens-ID (public.Company.id)"),
        }),
      },
      async ({ id }) => {
        const [firma] = await sql`select * from public."Company" where id = ${id} limit 1`;
        if (!firma) return fehler("Unternehmen nicht gefunden.");
        const stellen = await sql`
          select id, title, status, "createdAt" from public."JobPosting"
          where "companyId" = ${id} order by "createdAt" desc limit 50`;
        const notizen = await sql`
          select n.content, n.category, n.created_at, e.name as autor
          from admin.note n left join admin.employee e on e.id = n.author_id
          where n.entity_type = 'company' and n.entity_id = ${id} and n.deleted_at is null
          order by n.created_at desc limit 20`;
        return ok({ unternehmen: firma, stellen, notizen });
      },
    );

    server.registerTool(
      "stellen_suchen",
      {
        description: "Stellenanzeigen suchen (Titel, Unternehmen). Liefert id, Titel, Unternehmen, Status.",
        inputSchema: z.object({
          suche: z.string().optional(),
          limit: z.number().int().optional(),
        }),
      },
      async ({ suche, limit }) => {
        const like = `%${suche ?? ""}%`;
        const rows = await sql`
          select j.id, j.title, j.status, j."createdAt", c.name as unternehmen, c.ort
          from public."JobPosting" j
          left join public."Company" c on c.id = j."companyId"
          where j.status <> 'ARCHIVED'
            ${suche ? sql`and (j.title ilike ${like} or c.name ilike ${like})` : sql``}
          order by j."createdAt" desc
          limit ${begrenze(limit)}`;
        return ok(rows);
      },
    );

    // ── Matching ───────────────────────────────────────────────────────
    server.registerTool(
      "matching_fuer_kandidat",
      {
        description: "Echte Matching-Engine: passende Stellen für einen Kandidaten mit Score in Prozent.",
        inputSchema: z.object({
          kandidat_id: z.string(),
          limit: z.number().int().optional(),
        }),
      },
      async ({ kandidat_id, limit }) => {
        const [kandidat] = await sql`
          select email from admin.candidate
          where id = ${kandidat_id} and status <> 'ERASED' limit 1`;
        if (!kandidat) return fehler("Kandidat nicht gefunden.");
        const [user] = await sql`
          select "profileData" from public."User"
          where lower(email) = lower(${kandidat.email as string}) and role = 'APPLICANT' limit 1`;
        if (!user) return fehler("Kein Matching-Profil zu diesem Kandidaten.");
        const ergebnis = await rankJobsForProfile(user.profileData);
        return ok({
          profilLeer: ergebnis.profilLeer,
          matches: ergebnis.matches.slice(0, begrenze(limit)),
        });
      },
    );

    server.registerTool(
      "matching_fuer_stelle",
      {
        description: "Echte Matching-Engine: passende Kandidaten für eine Stelle mit Score in Prozent.",
        inputSchema: z.object({
          stelle_id: z.string(),
          limit: z.number().int().optional(),
        }),
      },
      async ({ stelle_id, limit }) => {
        const ranking = await rankCandidatesForJob(stelle_id);
        if (!ranking) return fehler("Stelle nicht gefunden.");
        return ok({
          matches: ranking.bewertet.slice(0, begrenze(limit)),
          ausgeschlossen: ranking.ausgeschlossen.slice(0, 20),
          ohneProfil: ranking.ohneProfil.length,
        });
      },
    );

    // ── Aufgaben & Notizen ─────────────────────────────────────────────
    server.registerTool(
      "aufgaben_liste",
      {
        description: "Aufgaben auflisten (offen oder erledigt), inkl. Zuständigem und Fälligkeit.",
        inputSchema: z.object({
          status: z.enum(["OPEN", "DONE"]).optional(),
          limit: z.number().int().optional(),
        }),
      },
      async ({ status, limit }) => {
        const rows = await sql`
          select t.id, t.title, t.description, t.status, t.priority, t.due_at,
                 e.name as zustaendig, t.entity_type, t.entity_id
          from admin.task t left join admin.employee e on e.id = t.assignee_id
          where t.deleted_at is null
            ${status ? sql`and t.status = ${status}` : sql``}
          order by t.due_at asc nulls last, t.created_at desc
          limit ${begrenze(limit)}`;
        return ok(rows);
      },
    );

    server.registerTool(
      "aufgabe_erstellen",
      {
        description: "Neue Aufgabe im Dashboard anlegen (erscheint unter /aufgaben, Quelle: Claude-MCP).",
        inputSchema: z.object({
          titel: z.string().min(2).max(200),
          beschreibung: z.string().max(2000).optional(),
          prioritaet: z.enum(["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"]).optional(),
          faellig_am: z.string().optional().describe("ISO-Datum, z. B. 2026-09-01"),
        }),
      },
      async ({ titel, beschreibung, prioritaet, faellig_am }) => {
        const due = faellig_am ? new Date(faellig_am) : null;
        if (due && Number.isNaN(due.getTime())) return fehler("Ungültiges Datum.");
        const [task] = await sql`
          insert into admin.task (title, description, due_at, priority, status)
          values (${titel}, ${`[Claude MCP] ${beschreibung ?? ""}`.trim()}, ${due},
                  ${prioritaet ?? "NORMAL"}, 'OPEN')
          returning id`;
        return ok({ erstellt: true, id: task.id });
      },
    );

    server.registerTool(
      "notiz_erstellen",
      {
        description: "Notiz zu einem Kandidaten oder Unternehmen hinterlegen (sichtbar auf der Detailseite).",
        inputSchema: z.object({
          inhalt: z.string().min(2).max(4000),
          entity_type: z.enum(["candidate", "company"]),
          entity_id: z.string(),
        }),
      },
      async ({ inhalt, entity_type, entity_id }) => {
        const [note] = await sql`
          insert into admin.note (content, category, entity_type, entity_id)
          values (${`[Claude MCP] ${inhalt}`}, 'ALLGEMEIN', ${entity_type}, ${entity_id})
          returning id`;
        return ok({ erstellt: true, id: note.id });
      },
    );

    // ── Finanzen & Team ────────────────────────────────────────────────
    server.registerTool(
      "finanzen_uebersicht",
      {
        description: "Finanz-Überblick: letzte Rechnungen, Auszahlungen (Prämien) und Summen.",
        inputSchema: z.object({ limit: z.number().int().optional() }),
      },
      async ({ limit }) => {
        const rechnungen = await sql`
          select nummer, recipient_name, company_name, total_cents, status, created_at
          from admin.invoice where deleted_at is null
          order by created_at desc limit ${begrenze(limit)}`;
        const auszahlungen = await sql`
          select art, status, recipient_name, amount_cents, created_at
          from admin.payout where deleted_at is null
          order by created_at desc limit ${begrenze(limit)}`;
        const [summen] = await sql`
          select
            (select coalesce(sum(total_cents),0)::bigint from admin.invoice
              where deleted_at is null and status = 'BEZAHLT') as rechnungen_bezahlt_cents,
            (select coalesce(sum(amount_cents),0)::bigint from admin.payout
              where deleted_at is null and status = 'OFFEN') as auszahlungen_offen_cents`;
        return ok({ summen, rechnungen, auszahlungen });
      },
    );

    server.registerTool(
      "mitarbeiter_liste",
      {
        description: "Alle Mitarbeiter mit Rolle, Status, Team und Arbeitslast (offene Aufgaben).",
      },
      async () => {
        const rows = await sql`
          select e.name, e.email, e.status, e.team, r.name as rolle,
                 e.last_login_at as letzter_login,
                 (select count(*)::int from admin.task t
                    where t.assignee_id = e.id and t.status = 'OPEN' and t.deleted_at is null) as offene_aufgaben
          from admin.employee e join admin.role r on r.id = e.role_id
          where e.deleted_at is null
          order by e.name`;
        return ok(rows);
      },
    );

    // ── Freie Nur-Lese-Abfrage (kompletter Lesezugriff) ───────────────
    server.registerTool(
      "sql_abfrage",
      {
        description:
          'Beliebige NUR-LESENDE SQL-Abfrage (SELECT) auf die Dashboard-Datenbank — Schema `admin.*` (CRM: candidate, task, note, invoice, payout, employee, call_session, proposal, placement, outbox_email, ki_usage …) und Plattform `public.*` ("User", "Company", "JobPosting", "JobApplication", "Referral"). Max. 200 Zeilen. Für alles, was die anderen Tools nicht abdecken.',
        inputSchema: z.object({
          abfrage: z.string().describe("Einzelne SELECT-Abfrage ohne Semikolon"),
        }),
      },
      async ({ abfrage }) => {
        const problem = pruefeReadonlySql(abfrage);
        if (problem) return fehler(problem);
        try {
          const rows = await sql.unsafe(
            `select * from (${abfrage.trim()}) _mcp limit ${LIMIT_MAX}`,
          );
          return ok(rows);
        } catch (e) {
          return fehler(`SQL-Fehler: ${e instanceof Error ? e.message : "unbekannt"}`);
        }
      },
    );
  },
  {
    serverInfo: { name: "portawerk-admin", version: "1.0.0" },
    verboseLogs: false,
  },
);

/** Token-Prüfung: Bearer-Header oder ?key= (für claude.ai-Connectoren). */
function autorisiert(req: Request): boolean {
  const secret = process.env.MCP_SECRET;
  if (!secret) return false; // ohne Secret: Endpunkt hart deaktiviert
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

async function geschuetzt(req: Request): Promise<Response> {
  if (!autorisiert(req)) {
    return new Response(JSON.stringify({ error: "Nicht autorisiert." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return handler(req);
}

export { geschuetzt as GET, geschuetzt as POST, geschuetzt as DELETE };
