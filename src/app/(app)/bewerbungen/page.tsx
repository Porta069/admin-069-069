import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatRelative } from "@/lib/format";
import { JOB_APPLICATION_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { KpiCard } from "@/components/common/kpi-card";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";

interface ApplicationRow {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  job_id: string;
  job_title: string;
  company_id: string | null;
  company_name: string | null;
}

const COLUMNS: DataTableColumn[] = [
  { key: "bewerber", label: "Bewerber" },
  { key: "stelle", label: "Stelle" },
  { key: "unternehmen", label: "Unternehmen" },
  { key: "status", label: "Status" },
  { key: "beworben", label: "Beworben am", sortable: true },
  { key: "aktivitaet", label: "Letzte Aktivität", sortable: true },
];

export default async function BewerbungenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("applications");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "beworben",
  });
  const status = firstParam(params.status);
  const unternehmen = firstParam(params.unternehmen);

  const orderBy = safeSort(
    sort,
    { beworben: `ja."createdAt"`, aktivitaet: `ja."updatedAt"` },
    `ja."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    where true
    ${
      q
        ? sql`and (u.email ilike ${like}
              or u."firstName" || ' ' || u."lastName" ilike ${like}
              or j.title ilike ${like} or c.name ilike ${like})`
        : sql``
    }
    ${status ? sql`and ja.status::text = ${status}` : sql``}
    ${unternehmen ? sql`and c.id = ${unternehmen}` : sql``}`;

  const [kpiRows, rows, countRows, companies] = await Promise.all([
    sql`
      select count(*)::int as total,
             count(*) filter (where status = 'SENT')::int as sent,
             count(*) filter (where status = 'INTERVIEW')::int as interview,
             count(*) filter (where status = 'ACCEPTED')::int as accepted
      from public."JobApplication"`,
    sql<ApplicationRow[]>`
      select ja.id, ja.status::text as status, ja."createdAt", ja."updatedAt",
             u."firstName", u."lastName", u.email,
             j.id as job_id, j.title as job_title,
             c.id as company_id, c.name as company_name
      from public."JobApplication" ja
      left join public."User" u on u.id = ja."userId"
      join public."JobPosting" j on j.id = ja."jobPostingId"
      left join public."Company" c on c.id = j."companyId"
      ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql<{ count: number }[]>`
      select count(*)::int as count
      from public."JobApplication" ja
      left join public."User" u on u.id = ja."userId"
      join public."JobPosting" j on j.id = ja."jobPostingId"
      left join public."Company" c on c.id = j."companyId"
      ${where}`,
    sql<{ id: string; name: string }[]>`
      select c.id, c.name
      from public."Company" c
      join public."JobPosting" j on j."companyId" = c.id
      join public."JobApplication" ja on ja."jobPostingId" = j.id
      group by c.id, c.name
      order by count(*) desc limit 20`,
  ]);
  const kpi = kpiRows[0];
  const count = countRows[0]?.count ?? 0;

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id,
    href: `/bewerbungen/${r.id}`,
    cells: {
      bewerber: (
        <span className="font-medium">
          {r.firstName || r.lastName
            ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()
            : (r.email ?? "Unbekannt")}
        </span>
      ),
      stelle: (
        <Link
          href={`/stellen/${r.job_id}`}
          className="hover:text-primary hover:underline"
        >
          {r.job_title}
        </Link>
      ),
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
      status: <StatusBadge map={JOB_APPLICATION_STATUS} value={r.status} />,
      beworben: <span className="tabular">{formatDate(r.createdAt)}</span>,
      aktivitaet: (
        <span className="text-muted-foreground">{formatRelative(r.updatedAt)}</span>
      ),
    },
  }));

  return (
    <>
      <PageHeader
        title="Bewerbungen"
        description="Alle Bewerbungen der Plattform — vom Eingang bis zur Zusage."
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Gesamt" value={(kpi?.total as number) ?? 0} accent />
        <KpiCard label="Ausstehend" value={(kpi?.sent as number) ?? 0} />
        <KpiCard label="Im Gespräch" value={(kpi?.interview as number) ?? 0} />
        <KpiCard label="Zusagen" value={(kpi?.accepted as number) ?? 0} />
      </div>
      <DataTable
        tableId="bewerbungen"
        columns={COLUMNS}
        rows={tableRows}
        total={count}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Bewerber, Stelle oder Firma…"
        emptyTitle="Keine Bewerbungen gefunden"
        emptyDescription="Sobald sich Handwerker auf Stellen bewerben, tauchen die Bewerbungen hier auf."
        toolbar={
          <>
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={Object.entries(JOB_APPLICATION_STATUS).map(
                ([value, def]) => ({ value, label: def.label }),
              )}
              className="h-9 w-40 bg-card"
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
