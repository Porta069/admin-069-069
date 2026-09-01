import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getJobGewerke, getJobCities, getJobCompanies } from "@/lib/lookups";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate } from "@/lib/format";
import { JOB_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { CreateJobDialog } from "./_components/create-job-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { ExportButton } from "../_shared/export-button";
import { gewerkLabel } from "./_lib/job-criteria";

interface JobRow {
  id: string;
  title: string;
  gewerk: string | null;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  status: string;
  createdAt: Date;
  company_id: string | null;
  company_name: string | null;
  application_count: number;
}

function formatSalary(min: number | null, max: number | null): string {
  const f = (v: number) => `${v.toLocaleString("de-DE")} €`;
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (min != null) return `ab ${f(min)}`;
  if (max != null) return `bis ${f(max)}`;
  return "—";
}

const COLUMNS: DataTableColumn[] = [
  { key: "titel", label: "Titel", sortable: true },
  { key: "unternehmen", label: "Unternehmen" },
  { key: "gewerk", label: "Gewerk" },
  { key: "stadt", label: "Stadt" },
  { key: "gehalt", label: "Gehalt", className: "tabular" },
  { key: "status", label: "Status" },
  { key: "bewerbungen", label: "Bewerbungen", className: "tabular" },
  { key: "erstellt", label: "Erstellt", sortable: true },
];

export default async function StellenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("jobs");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "erstellt",
  });
  const status = firstParam(params.status);
  const gewerk = firstParam(params.gewerk);
  const stadt = firstParam(params.stadt);
  const unternehmen = firstParam(params.unternehmen);

  const orderBy = safeSort(
    sort,
    { titel: `j.title`, erstellt: `j."createdAt"` },
    `j."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;
  const canCreate = can(employee, "jobs", "create");

  const where = sql`
    where true
    ${q ? sql`and (j.title ilike ${like} or c.name ilike ${like})` : sql``}
    ${status ? sql`and j.status::text = ${status}` : sql``}
    ${gewerk ? sql`and j.gewerk = ${gewerk}` : sql``}
    ${stadt ? sql`and j.city = ${stadt}` : sql``}
    ${unternehmen ? sql`and j."companyId" = ${unternehmen}` : sql``}`;

  const [rows, countRows, gewerke, staedte, companies, alleUnternehmen] = await Promise.all([
    sql<JobRow[]>`
      select j.id, j.title, j.gewerk, j.city, j."salaryMin", j."salaryMax",
             j.status::text as status, j."createdAt",
             c.id as company_id, c.name as company_name,
             (select count(*)::int from public."JobApplication" ja
              where ja."jobPostingId" = j.id) as application_count
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql<{ count: number }[]>`
      select count(*)::int as count
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      ${where}`,
    // Gecacht, invalidiert über Tag „jobs" (siehe lib/lookups).
    getJobGewerke(),
    getJobCities(),
    getJobCompanies(),
    // Vollständige Unternehmensliste nur laden, wenn der Anlege-Dialog überhaupt
    // gezeigt wird (spart eine 500-Zeilen-Query bei jedem Listenaufruf ohne Recht).
    canCreate
      ? sql<{ id: string; name: string }[]>`
          select id, name from public."Company" order by name asc limit 500`
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const count = countRows[0]?.count ?? 0;

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id,
    href: `/stellen/${r.id}`,
    cells: {
      titel: <span className="font-medium">{r.title}</span>,
      unternehmen: r.company_id ? (
        <Link
          href={`/unternehmen/${r.company_id}`}
          className="hover:text-primary hover:underline"
        >
          {r.company_name}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      gewerk: r.gewerk ? gewerkLabel(r.gewerk) : "—",
      stadt: r.city ?? "—",
      gehalt: formatSalary(r.salaryMin, r.salaryMax),
      status: <StatusBadge map={JOB_STATUS} value={r.status} />,
      bewerbungen:
        r.application_count > 0 ? (
          <span className="font-medium">{r.application_count}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
      erstellt: <span className="tabular">{formatDate(r.createdAt)}</span>,
    },
  }));

  return (
    <>
      <PageHeader
        title="Stellenanzeigen"
        description="Alle Jobs der Plattform — mit Bewerbungszahlen und Matching-Vorbereitung."
        actions={
          <>
            {can(employee, "jobs", "export") && <ExportButton modul="stellen" />}
            {can(employee, "jobs", "create") && (
              <CreateJobDialog companies={alleUnternehmen as { id: string; name: string }[]} />
            )}
          </>
        }
      />
      <DataTable
        tableId="stellen"
        columns={COLUMNS}
        rows={tableRows}
        total={count}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Titel oder Unternehmen…"
        emptyTitle="Keine Stellenanzeigen gefunden"
        emptyDescription="Sobald Unternehmen Jobs veröffentlichen, erscheinen sie hier. Filter prüfen oder Suchbegriff anpassen."
        toolbar={
          <>
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={Object.entries(JOB_STATUS).map(([value, def]) => ({
                value,
                label: def.label,
              }))}
              className="h-9 w-36 bg-card"
            />
            <FilterSelect
              param="gewerk"
              placeholder="Alle Gewerke"
              options={gewerke.map((g) => ({
                value: g.gewerk,
                label: gewerkLabel(g.gewerk),
              }))}
              className="h-9 w-40 bg-card"
            />
            <FilterSelect
              param="stadt"
              placeholder="Alle Städte"
              options={staedte.map((s) => ({ value: s.city, label: s.city }))}
              className="h-9 w-36 bg-card"
            />
            <FilterSelect
              param="unternehmen"
              placeholder="Alle Unternehmen"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              className="h-9 w-48 bg-card"
            />
          </>
        }
      />
    </>
  );
}
