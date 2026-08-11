import { getEmployee } from "@/lib/auth";
import { hasPermission, type PermissionModule } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatDate } from "@/lib/format";
import {
  APPLICATION_STATUS,
  CANDIDATE_STATUS,
  COMPANY_STATUS,
  JOB_APPLICATION_STATUS,
  JOB_STATUS,
  PLACEMENT_STATUS,
  PRIORITY_LABELS,
  REFERRAL_STATUS,
  statusDef,
  type Priority,
  type StatusDef,
} from "@/lib/definitions";

const MAX_ROWS = 5000;

type Cell = string | number | boolean | Date | null | undefined;

/** Semikolon-CSV im deutschen Excel-Dialekt: Felder mit ;/"/Zeilenumbruch quoten. */
function csvField(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? formatDate(value)
      : typeof value === "boolean"
        ? value
          ? "Ja"
          : "Nein"
        : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(";"));
  // UTF-8 BOM, damit Excel Umlaute korrekt erkennt.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function berlinToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
}

function euro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function label(map: Record<string, StatusDef>, value: string | null): string {
  return value ? statusDef(map, value).label : "";
}

function first(params: URLSearchParams, key: string): string | undefined {
  const v = params.get(key)?.trim();
  return v || undefined;
}

interface ModuleDef {
  permission: PermissionModule;
  entityType: string;
  load: (p: URLSearchParams) => Promise<{ header: string[]; rows: Cell[][] }>;
}

const INTENT_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv suchend",
  PASSIVE: "Passiv",
};

const COMPANY_SOURCE_LABELS: Record<string, string> = {
  SELF: "Selbst registriert",
  ADMIN: "Manuell angelegt",
  AI: "KI-Import",
};

const MODULES: Record<string, ModuleDef> = {
  // ── Kandidaten ─────────────────────────────────────────────────────────
  kandidaten: {
    permission: "candidates",
    entityType: "candidate",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");
      const bundesland = first(p, "bundesland");
      const beruf = first(p, "beruf");
      const prio = first(p, "prio");
      const verifiziert = first(p, "verifiziert");
      const tag = first(p, "tag");

      const rows = await sql`
        select a.id, a."firstName", a."lastName", a.email, a.phone, a.profession,
               a."federalState", a."birthYear", a.availability,
               a."searchIntent"::text as "searchIntent", a.status::text as status,
               a.verified, a."createdAt", a."retentionUntil",
               cm.status as pipeline_status, cm.priority,
               e.name as assignee_name
        from public."Application" a
        left join admin.candidate_meta cm on cm.application_id = a.id
        left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
        where a.status <> 'ERASED'
          ${
            q
              ? sql`and (a."firstName" || ' ' || a."lastName" ilike ${like}
                    or a.email ilike ${like} or a.profession ilike ${like})`
              : sql``
          }
          ${status ? sql`and coalesce(cm.status, 'NEU') = ${status}` : sql``}
          ${bundesland ? sql`and a."federalState" = ${bundesland}` : sql``}
          ${beruf ? sql`and a.profession = ${beruf}` : sql``}
          ${prio ? sql`and coalesce(cm.priority, 'NORMAL') = ${prio}` : sql``}
          ${verifiziert ? sql`and a.verified = ${verifiziert === "ja"}` : sql``}
          ${
            tag
              ? sql`and exists (
                  select 1 from admin.entity_tag et
                  join admin.tag t on t.id = et.tag_id
                  where et.entity_type = 'candidate' and et.entity_id = a.id
                    and t.name = ${tag})`
              : sql``
          }
        order by a."createdAt" desc
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Vorname", "Nachname", "E-Mail", "Telefon", "Beruf", "Bundesland",
          "Geburtsjahr", "Verfügbarkeit", "Suchintention", "Plattform-Status",
          "Pipeline-Status", "Priorität", "Zuständig", "Verifiziert",
          "Registriert", "Aufbewahrung bis",
        ],
        rows: rows.map((r) => [
          r.firstName as string,
          r.lastName as string,
          r.email as string,
          r.phone as string | null,
          r.profession as string | null,
          r.federalState as string | null,
          r.birthYear as number | null,
          r.availability as string | null,
          r.searchIntent ? (INTENT_LABELS[r.searchIntent as string] ?? (r.searchIntent as string)) : "",
          label(APPLICATION_STATUS, r.status as string),
          label(CANDIDATE_STATUS, (r.pipeline_status as string) ?? "NEU"),
          PRIORITY_LABELS[((r.priority as Priority) ?? "NORMAL")] ?? "",
          r.assignee_name as string | null,
          Boolean(r.verified),
          r.createdAt as Date,
          r.retentionUntil as Date | null,
        ]),
      };
    },
  },

  // ── Unternehmen ────────────────────────────────────────────────────────
  unternehmen: {
    permission: "companies",
    entityType: "company",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");
      const quelle = first(p, "quelle");
      const ort = first(p, "ort");
      const tag = first(p, "tag");

      const rows = await sql`
        select c.id, c.name, c.strasse, c.plz, c.ort, c.website,
               c."kontaktName", c."kontaktEmail", c."kontaktTelefon",
               c.source::text as source, c."createdAt",
               cm.status as meta_status, e.name as assignee_name,
               (select count(*)::int from public."JobPosting" j
                where j."companyId" = c.id and j.status = 'ACTIVE') as active_jobs,
               (select count(*)::int from public."JobApplication" ja
                join public."JobPosting" j2 on j2.id = ja."jobPostingId"
                where j2."companyId" = c.id) as total_applications
        from public."Company" c
        left join admin.company_meta cm on cm.company_id = c.id
        left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
        where true
          ${
            q
              ? sql`and (c.name ilike ${like} or c.ort ilike ${like} or c."kontaktName" ilike ${like})`
              : sql``
          }
          ${status ? sql`and coalesce(cm.status, 'NEU') = ${status}` : sql``}
          ${quelle ? sql`and c.source::text = ${quelle}` : sql``}
          ${ort ? sql`and c.ort = ${ort}` : sql``}
          ${
            tag
              ? sql`and exists (
                  select 1 from admin.entity_tag et
                  join admin.tag t on t.id = et.tag_id
                  where et.entity_type = 'company' and et.entity_id = c.id
                    and t.name = ${tag})`
              : sql``
          }
        order by c."createdAt" desc
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Name", "Straße", "PLZ", "Ort", "Website", "Kontakt", "Kontakt-E-Mail",
          "Kontakt-Telefon", "Status", "Zuständig", "Aktive Jobs", "Bewerbungen",
          "Quelle", "Erstellt",
        ],
        rows: rows.map((r) => [
          r.name as string,
          r.strasse as string | null,
          r.plz as string | null,
          r.ort as string | null,
          r.website as string | null,
          r.kontaktName as string | null,
          r.kontaktEmail as string | null,
          r.kontaktTelefon as string | null,
          label(COMPANY_STATUS, (r.meta_status as string) ?? "NEU"),
          r.assignee_name as string | null,
          r.active_jobs as number,
          r.total_applications as number,
          r.source ? (COMPANY_SOURCE_LABELS[r.source as string] ?? (r.source as string)) : "",
          r.createdAt as Date,
        ]),
      };
    },
  },

  // ── Stellen ────────────────────────────────────────────────────────────
  stellen: {
    permission: "jobs",
    entityType: "job",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");
      const gewerk = first(p, "gewerk");
      const stadt = first(p, "stadt");
      const unternehmen = first(p, "unternehmen");

      const rows = await sql`
        select j.id, j.title, j.gewerk, j.city, j."salaryMin", j."salaryMax",
               j.montage, j.urlaubstage, j.status::text as status, j."createdAt",
               c.name as company_name,
               (select count(*)::int from public."JobApplication" ja
                where ja."jobPostingId" = j.id) as application_count
        from public."JobPosting" j
        left join public."Company" c on c.id = j."companyId"
        where true
          ${q ? sql`and (j.title ilike ${like} or c.name ilike ${like})` : sql``}
          ${status ? sql`and j.status::text = ${status}` : sql``}
          ${gewerk ? sql`and j.gewerk = ${gewerk}` : sql``}
          ${stadt ? sql`and j.city = ${stadt}` : sql``}
          ${unternehmen ? sql`and j."companyId" = ${unternehmen}` : sql``}
        order by j."createdAt" desc
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Titel", "Unternehmen", "Gewerk", "Stadt", "Gehalt min (€)",
          "Gehalt max (€)", "Montage", "Urlaubstage", "Status", "Bewerbungen",
          "Erstellt",
        ],
        rows: rows.map((r) => [
          r.title as string,
          r.company_name as string | null,
          r.gewerk as string | null,
          r.city as string | null,
          r.salaryMin as number | null,
          r.salaryMax as number | null,
          r.montage as string | null,
          r.urlaubstage as number | null,
          label(JOB_STATUS, r.status as string),
          r.application_count as number,
          r.createdAt as Date,
        ]),
      };
    },
  },

  // ── Bewerbungen ────────────────────────────────────────────────────────
  bewerbungen: {
    permission: "applications",
    entityType: "application",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");
      const unternehmen = first(p, "unternehmen");

      const rows = await sql`
        select ja.id, ja.status::text as status, ja."createdAt", ja."updatedAt",
               u."firstName", u."lastName", u.email,
               j.title as job_title, c.name as company_name
        from public."JobApplication" ja
        left join public."User" u on u.id = ja."userId"
        join public."JobPosting" j on j.id = ja."jobPostingId"
        left join public."Company" c on c.id = j."companyId"
        where true
          ${
            q
              ? sql`and (u.email ilike ${like}
                    or u."firstName" || ' ' || u."lastName" ilike ${like}
                    or j.title ilike ${like} or c.name ilike ${like})`
              : sql``
          }
          ${status ? sql`and ja.status::text = ${status}` : sql``}
          ${unternehmen ? sql`and c.id = ${unternehmen}` : sql``}
        order by ja."createdAt" desc
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Bewerber", "E-Mail", "Stelle", "Unternehmen", "Status",
          "Beworben am", "Letzte Aktivität",
        ],
        rows: rows.map((r) => [
          `${(r.firstName as string | null) ?? ""} ${(r.lastName as string | null) ?? ""}`.trim(),
          r.email as string | null,
          r.job_title as string,
          r.company_name as string | null,
          label(JOB_APPLICATION_STATUS, r.status as string),
          r.createdAt as Date,
          r.updatedAt as Date,
        ]),
      };
    },
  },

  // ── Vermittlungen ──────────────────────────────────────────────────────
  vermittlungen: {
    permission: "placements",
    entityType: "placement",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");

      const rows = await sql`
        select pl.candidate_name, pl.company_name, pl.job_title, pl.status,
               pl.placed_at, pl.base_fee_cents, pl.commission_cents, pl.notes,
               pl.referral_id, e.name as employee_name
        from admin.placement pl
        left join admin.employee e on e.id = pl.employee_id
        where pl.deleted_at is null
          ${
            q
              ? sql`and (pl.candidate_name ilike ${like} or pl.company_name ilike ${like} or coalesce(pl.job_title, '') ilike ${like})`
              : sql``
          }
          ${status ? sql`and pl.status = ${status}` : sql``}
        order by pl.placed_at desc nulls last
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Kandidat", "Unternehmen", "Stelle", "Status", "Vermittelt am",
          "Grundgebühr (€)", "Provision (€)", "Gesamt (€)", "Mitarbeiter",
          "Referral", "Notizen",
        ],
        rows: rows.map((r) => {
          const base = Number(r.base_fee_cents ?? 0);
          const commission = Number(r.commission_cents ?? 0);
          return [
            r.candidate_name as string,
            r.company_name as string | null,
            r.job_title as string | null,
            label(PLACEMENT_STATUS, r.status as string),
            r.placed_at as Date | null,
            euro(base),
            euro(commission),
            euro(base + commission),
            r.employee_name as string | null,
            Boolean(r.referral_id),
            r.notes as string | null,
          ];
        }),
      };
    },
  },

  // ── Referrals (Affiliate) ──────────────────────────────────────────────
  referrals: {
    permission: "affiliates",
    entityType: "referral",
    async load(p) {
      const q = first(p, "q")?.slice(0, 200);
      const like = `%${q}%`;
      const status = first(p, "status");
      const partnerId = first(p, "partner");

      const rows = await sql`
        select r."candidateName", r."candidateTrade", r.status, r."rewardCents",
               r."createdAt", r."placedAt", r."paidAt", p.name as partner_name
        from public."Referral" r
        left join public."Partner" p on p.id = r."partnerId"
        where true
          ${q ? sql`and (r."candidateName" ilike ${like} or p.name ilike ${like})` : sql``}
          ${status ? sql`and r.status = ${status}` : sql``}
          ${partnerId ? sql`and r."partnerId" = ${partnerId}` : sql``}
        order by r."createdAt" desc
        limit ${MAX_ROWS}`;

      return {
        header: [
          "Partner", "Kandidat", "Gewerk", "Status", "Registriert",
          "Vermittelt am", "Ausgezahlt am", "Prämie (€)",
        ],
        rows: rows.map((r) => [
          r.partner_name as string | null,
          r.candidateName as string | null,
          r.candidateTrade as string | null,
          label(REFERRAL_STATUS, r.status as string),
          r.createdAt as Date,
          r.placedAt as Date | null,
          r.paidAt as Date | null,
          r.rewardCents != null && Number(r.rewardCents) > 0
            ? euro(Number(r.rewardCents))
            : "",
        ]),
      };
    },
  },
};

/**
 * CSV-Export pro Modul mit denselben Filter-Query-Params wie die Listen-Seite.
 * Permission-Check serverseitig: <Modul>:export, sonst 403.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ modul: string }> },
) {
  const { modul } = await params;
  const def = MODULES[modul];
  if (!def) {
    return new Response("Unbekanntes Modul", { status: 404 });
  }

  const employee = await getEmployee();
  if (!employee) {
    return new Response("Nicht angemeldet", { status: 401 });
  }
  if (!hasPermission(employee.permissions, def.permission, "export")) {
    return new Response("Keine Berechtigung für den Export", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { header, rows } = await def.load(searchParams);
    const csv = buildCsv(header, rows);

    await recordAudit({
      actorId: employee.id,
      action: "export.csv",
      entityType: def.entityType,
      metadata: { modul, rows: rows.length },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${modul}-${berlinToday()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("CSV-Export fehlgeschlagen", e);
    return new Response("Export fehlgeschlagen. Bitte erneut versuchen.", {
      status: 500,
    });
  }
}
