import crypto from "crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { sql } from "@/lib/db";
import { rankCandidatesForJob, rankJobsForProfile } from "@/lib/matching/rank";
import { queueEmail, processOutbox, mailerConfigured } from "@/lib/mailer";
import { renderBrandedText } from "@/lib/email-templates";
import { runSync } from "@/lib/sync";

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

// Nebenwirkungs-/System-Funktionen: kein Datei-/Netz-/Prozesszugriff und kein
// DoS (pg_sleep) über SQL — unabhängig von den DB-Rollenrechten hart gesperrt.
const GEFAEHRLICHE_FUNKTIONEN =
  /\b(pg_sleep|pg_sleep_for|pg_sleep_until|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_ls_logdir|pg_ls_waldir|pg_stat_file|lo_import|lo_export|lo_get|lo_put|lo_from_bytea|dblink|dblink_exec|set_config|current_setting|pg_reload_conf|pg_terminate_backend|pg_cancel_backend|pg_read_server_files)\b/i;
// Authentifizierungs-Systemtabellen/-sichten.
const SYSTEM_SECRETS = /\b(pg_authid|pg_shadow|pg_user_mappings)\b/i;
// Geheimnis-Spalten dürfen nie über MCP abfließen.
const SECRET_SPALTEN = /\b(password_hash|totp_secret|ical_token|token_hash|reset_token|secret_value|access_token|refresh_token)\b/i;
// Steuer-/Sicherheits-Tabellen dürfen über MCP nicht beschrieben werden
// (kein Rechte-Hochstufen, kein Pause-Schalter/Audit/Log manipulieren). An
// into/update/from/join verankert, damit die Wörter in Textwerten nicht
// fälschlich blocken.
const GESCHUETZTE_TABELLEN =
  /\b(into|update|from|join)\s+(?:(?:admin|public)\.)?"?(employee|role|session|setting|audit|mcp_log|user|account)"?\b/i;

/** Nur-Lese-Guard für freie SQL-Abfragen. Gibt Fehlertext oder null zurück. */
function pruefeReadonlySql(q: string): string | null {
  const s = q.trim();
  if (s.includes(";")) return "Nur eine einzelne Abfrage ohne Semikolon erlaubt.";
  if (!/^(select|with)\b/i.test(s)) return "Nur SELECT-/WITH-Abfragen erlaubt.";
  if (
    /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|vacuum|call|do|reset|listen|notify|refresh|comment|security|import|reindex)\b/i.test(
      s,
    )
  ) {
    return "Nur lesende Abfragen erlaubt (kein DML/DDL).";
  }
  if (GEFAEHRLICHE_FUNKTIONEN.test(s)) return "Diese Funktion ist gesperrt (Datei-/Netz-/System-/Sleep-Zugriff).";
  if (SYSTEM_SECRETS.test(s)) return "Zugriff auf System-Authentifizierungstabellen ist gesperrt.";
  if (SECRET_SPALTEN.test(s)) return "Abfrage von Geheimnis-Spalten (Passwörter, 2FA-, Token-Felder) ist gesperrt.";
  return null;
}

const handler = createMcpHandler(
  (server) => {
    // ── Pausieren & Protokollieren ─────────────────────────────────────
    // Jeder Tool-Aufruf prüft die MCP-Einstellungen (aktiv / schreiben) und
    // schreibt einen Protokoll-Eintrag nach admin.mcp_log — steuerbar unter
    // /einstellungen/ki.
    const WRITE_TOOLS = new Set([
      "sql_schreiben",
      "aufgabe_erstellen",
      "notiz_erstellen",
      "email_senden",
      "outbox_verarbeiten",
      "sync_ausfuehren",
    ]);
    async function mcpConfig(): Promise<{ aktiv: boolean; schreiben: boolean }> {
      const [row] = await sql`select value from admin.setting where key = 'mcp' limit 1`;
      const v = (row?.value ?? {}) as { aktiv?: boolean; schreiben?: boolean };
      return { aktiv: v.aktiv !== false, schreiben: v.schreiben !== false };
    }
    async function protokoll(
      tool: string,
      art: string,
      args: unknown,
      erfolg: boolean,
      info: string,
    ): Promise<void> {
      try {
        await sql`insert into admin.mcp_log (tool, art, argumente, ok, info)
          values (${tool}, ${art}, ${sql.json((args ?? {}) as never)}, ${erfolg}, ${info.slice(0, 2000)})`;
      } catch {
        /* Protokoll-Fehler (z. B. Tabelle fehlt) nie den Aufruf abbrechen lassen */
      }
    }
    function kurzinfo(res: { content?: { text?: string }[] } | undefined): string {
      const t = res?.content?.[0]?.text ?? "";
      return String(t).slice(0, 1500);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reg = (name: string, config: any, handler: (args: any, extra: any) => Promise<any>) => {
      const art = WRITE_TOOLS.has(name) ? "WRITE" : "READ";
      server.registerTool(name, config, (async (args: unknown, extra: unknown) => {
        const cfg = await mcpConfig();
        if (!cfg.aktiv) {
          await protokoll(name, art, args, false, "MCP pausiert");
          return fehler("Der MCP-Zugriff ist in den KI-Einstellungen pausiert.");
        }
        if (art === "WRITE" && !cfg.schreiben) {
          await protokoll(name, art, args, false, "Schreibzugriff pausiert");
          return fehler("Schreibzugriff ist pausiert — aktuell nur Lesen aktiv.");
        }
        try {
          const res = await handler(args, extra);
          await protokoll(name, art, args, !res?.isError, kurzinfo(res));
          return res;
        } catch (e) {
          await protokoll(name, art, args, false, e instanceof Error ? e.message : "Fehler");
          throw e;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);
    };

    // ── Überblick ──────────────────────────────────────────────────────
    reg(
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
    reg(
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

    reg(
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
    reg(
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

    reg(
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

    reg(
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
    reg(
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

    reg(
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
    reg(
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

    reg(
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

    reg(
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
    reg(
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

    reg(
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

    // ── Schema-Einsicht ────────────────────────────────────────────────
    reg(
      "datenbank_schema",
      {
        description:
          "Datenbank-Schema anzeigen: alle Tabellen mit Spalten (Typ, Nullable) in den Schemas `admin` und `public`. Damit weiß Claude, welche Tabellen/Spalten es lesen und schreiben kann.",
        inputSchema: z.object({
          tabelle: z.string().optional().describe("Nur diese Tabelle (Name ohne Schema), sonst alle"),
        }),
      },
      async ({ tabelle }) => {
        const rows = await sql`
          select table_schema, table_name,
                 json_agg(json_build_object('spalte', column_name, 'typ', data_type, 'nullable', is_nullable)
                          order by ordinal_position) as spalten
          from information_schema.columns
          where table_schema in ('admin','public')
            ${tabelle ? sql`and table_name = ${tabelle}` : sql``}
          group by table_schema, table_name
          order by table_schema, table_name`;
        return ok(rows);
      },
    );

    // ── Voller Datensatz-Schreibzugriff (INSERT/UPDATE/DELETE) ─────────
    reg(
      "sql_schreiben",
      {
        description:
          "Voller Schreibzugriff auf Datensätze: beliebiges INSERT/UPDATE/DELETE (auch massenhaft). Ein einzelnes Statement ohne Semikolon. Gib bei UPDATE/DELETE möglichst eine WHERE-Klausel an. `returning ...` anhängen, um betroffene Zeilen zurückzubekommen. Nutze zuerst `datenbank_schema` für Tabellen/Spalten. Nicht erlaubt: strukturzerstörende Befehle (DROP/TRUNCATE/ALTER/GRANT/REVOKE) — die würden das Dashboard unwiederbringlich beschädigen.",
        inputSchema: z.object({
          statement: z.string().describe("Einzelnes Schreib-Statement, z. B. update admin.candidate set status='ACTIVE' where id='…' returning id"),
        }),
      },
      async ({ statement }) => {
        const s = statement.trim().replace(/;+\s*$/, "");
        if (s.includes(";")) return fehler("Nur ein einzelnes Statement ohne Semikolon.");
        if (/^(select|with)\b/i.test(s)) return fehler("Für Lesen bitte `sql_abfrage` verwenden.");
        if (!/^(insert|update|delete)\b/i.test(s)) {
          return fehler("Nur INSERT/UPDATE/DELETE erlaubt.");
        }
        // Struktur-zerstörende Befehle blocken (auch verschachtelt) — schützt vor Totalverlust.
        if (/\b(drop|truncate|alter|grant|revoke|create|reindex|vacuum|comment)\b/i.test(s)) {
          return fehler(
            "Strukturbefehle (DROP/TRUNCATE/ALTER/GRANT/CREATE …) sind gesperrt. Datensätze anlegen/ändern/löschen ist erlaubt.",
          );
        }
        if (GEFAEHRLICHE_FUNKTIONEN.test(s)) {
          return fehler("Gesperrte Funktion (Datei-/Netz-/System-/Sleep-Zugriff).");
        }
        // Sicherheits-/Steuer-Tabellen schützen: keine Rechte-Hochstufung, keine
        // Manipulation von Sessions, Pause-Schalter (setting), Audit oder MCP-Log.
        if (GESCHUETZTE_TABELLEN.test(s)) {
          return fehler(
            "Diese Tabelle ist über MCP schreibgeschützt (Mitarbeiter/Rollen/Sessions/Einstellungen/Audit/Log). Solche Änderungen bitte im Dashboard vornehmen.",
          );
        }
        try {
          const res = await sql.unsafe(s);
          return ok({ geaendert: res.count ?? (Array.isArray(res) ? res.length : 0), zeilen: res });
        } catch (e) {
          return fehler(`SQL-Fehler: ${e instanceof Error ? e.message : "unbekannt"}`);
        }
      },
    );

    // ── E-Mail senden (branded, echter Versand) ────────────────────────
    reg(
      "email_senden",
      {
        description:
          "Sendet eine E-Mail im Porta-Jobs-Design (Logo, Headline = Betreff, Footer) über die Outbox/Brevo. Betreff wird zur Headline, Text zum Fließtext.",
        inputSchema: z.object({
          an: z.string().email(),
          empfaenger_name: z.string().optional(),
          betreff: z.string().min(1),
          text: z.string().min(1),
          sofort_senden: z.boolean().optional().describe("true = direkt zustellen (Default true), false = nur einreihen"),
        }),
      },
      async ({ an, empfaenger_name, betreff, text, sofort_senden }) => {
        if (!mailerConfigured()) return fehler("E-Mail-Versand nicht konfiguriert (Brevo-Keys fehlen).");
        const rendered = renderBrandedText(betreff, text);
        await queueEmail({
          toEmail: an,
          toName: empfaenger_name ?? null,
          subject: rendered.subject,
          body: rendered.text,
          html: rendered.html,
          kind: "SYSTEM",
          entityType: "mcp_email",
        });
        let verarbeitet = 0;
        if (sofort_senden !== false) verarbeitet = await processOutbox(5);
        return ok({ eingereiht: true, verarbeitet });
      },
    );

    reg(
      "outbox_verarbeiten",
      {
        description: "Verarbeitet die E-Mail-Outbox (versendet ausstehende Mails über Brevo).",
        inputSchema: z.object({ anzahl: z.number().int().optional() }),
      },
      async ({ anzahl }) => {
        const n = await processOutbox(Math.min(Math.max(anzahl ?? 25, 1), 100));
        return ok({ verarbeitet: n });
      },
    );

    reg(
      "sync_ausfuehren",
      {
        description:
          "Führt den Daten-Sync aus (übernimmt neue Registrierungen/Bewerbungen von der Plattform, erzeugt fällige Aufgaben, backfillt Prämien, verarbeitet Automationen).",
      },
      async () => {
        await runSync();
        return ok({ sync: "ausgeführt" });
      },
    );

    // ── Freie Nur-Lese-Abfrage (kompletter Lesezugriff) ───────────────
    reg(
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

/** Konstanter Zeitvergleich (verhindert Timing-Seitenkanal auf das Secret). */
function sicherGleich(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Token-Prüfung — NUR über den Authorization-Header (Bearer). Der frühere
 * `?key=`-Query-Weg wurde entfernt: Ein Vollzugriffs-Token in der URL landet
 * in Access-Logs/Referrer/Proxy-Caches. Der claude.ai-Connector unterstützt
 * Request-Header — dort `Authorization: Bearer <MCP_SECRET>` eintragen.
 */
function autorisiert(req: Request): boolean {
  const secret = process.env.MCP_SECRET;
  if (!secret) return false; // ohne Secret: Endpunkt hart deaktiviert
  const auth = req.headers.get("authorization") ?? "";
  return sicherGleich(auth, `Bearer ${secret}`);
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
