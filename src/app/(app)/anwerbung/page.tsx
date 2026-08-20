import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { LEAD_STATUS, LEAD_STATUSES } from "./lead-defs";
import {
  AddLeadDialog,
  ArchiveLeadButton,
  LeadEmailButton,
  LeadStatusSelect,
} from "./_components/lead-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unternehmens-Anwerbung" };

const COLUMNS: DataTableColumn[] = [
  { key: "firma", label: "Unternehmen", sortable: true },
  { key: "kontakt", label: "Kontakt" },
  { key: "ort", label: "Ort" },
  { key: "status", label: "Status" },
  { key: "kontaktiert", label: "Letzter Kontakt", sortable: true },
  { key: "zustaendig", label: "Zuständig" },
  { key: "aktion", label: "" },
];

export default async function AnwerbungPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("companies");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, { sort: "erstellt" });
  const status = firstParam(params.status);

  const canCreate = can(employee, "companies", "create");
  const canEdit = can(employee, "companies", "edit");

  const orderBy = safeSort(
    sort,
    { firma: "name", kontaktiert: "last_contacted_at", erstellt: "created_at" },
    "created_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, [{ count }], [kpi], employees] = await Promise.all([
    sql`
      select l.*, e.name as assignee_name, e.avatar_color
      from admin.company_lead l
      left join admin.employee e on e.id = l.assignee_id
      where l.deleted_at is null
        ${q ? sql`and (l.name ilike ${like} or coalesce(l.ansprechpartner,'') ilike ${like} or coalesce(l.ort,'') ilike ${like})` : sql``}
        ${status ? sql`and l.status = ${status}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count from admin.company_lead l
      where l.deleted_at is null
        ${q ? sql`and (l.name ilike ${like} or coalesce(l.ansprechpartner,'') ilike ${like} or coalesce(l.ort,'') ilike ${like})` : sql``}
        ${status ? sql`and l.status = ${status}` : sql``}`,
    sql`
      select
        count(*) filter (where deleted_at is null)::int as offen,
        count(*) filter (where deleted_at is null and status = 'NEU')::int as neu,
        count(*) filter (where deleted_at is null and status in ('KONTAKTIERT','INTERESSIERT'))::int as in_kontakt,
        count(*) filter (where deleted_at is null and status = 'GEWONNEN')::int as gewonnen
      from admin.company_lead`,
    sql`select id, name from admin.employee where status = 'ACTIVE' and deleted_at is null order by name`,
  ]);

  const empList = employees.map((e) => ({ id: e.id as string, name: e.name as string }));

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    cells: {
      firma: (
        <div className="min-w-0">
          <span className="font-medium">{r.name as string}</span>
          {r.website ? (
            <a
              href={`https://${String(r.website).replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              {String(r.website).replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>
      ),
      kontakt: (
        <div className="min-w-0 text-sm">
          {r.ansprechpartner ? <div>{r.ansprechpartner as string}</div> : null}
          {r.email ? (
            <a href={`mailto:${r.email}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
              {r.email as string}
            </a>
          ) : null}
          {r.phone ? <div className="text-xs text-muted-foreground">{r.phone as string}</div> : null}
        </div>
      ),
      ort: (r.ort as string | null) ?? "—",
      status: canEdit ? (
        <LeadStatusSelect id={r.id as string} status={r.status as string} />
      ) : (
        <StatusBadge map={LEAD_STATUS} value={r.status as string} />
      ),
      kontaktiert: r.last_contacted_at ? (
        <span className="tabular">{formatDate(r.last_contacted_at as string)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      zustaendig: r.assignee_name ? (
        <span className="inline-flex items-center gap-2">
          <EmployeeAvatar name={r.assignee_name as string} color={r.avatar_color as string | null} size="sm" />
          <span className="text-sm">{r.assignee_name as string}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      aktion: canEdit ? (
        <span className="flex items-center justify-end gap-0.5">
          <LeadEmailButton
            id={r.id as string}
            name={r.name as string}
            ansprechpartner={(r.ansprechpartner as string | null) ?? null}
            email={(r.email as string | null) ?? null}
          />
          <ArchiveLeadButton id={r.id as string} />
        </span>
      ) : null,
    },
  }));

  return (
    <>
      <PageHeader
        title="Unternehmens-Anwerbung"
        description="Betriebe anwerben, die noch nicht auf der Plattform sind — Pipeline pflegen und direkt per E-Mail kontaktieren."
        actions={canCreate ? <AddLeadDialog employees={empList} /> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Offene Leads" value={formatNumber(kpi.offen as number)} hint="nicht archiviert" />
        <KpiCard label="Neu" value={formatNumber(kpi.neu as number)} hint="noch nicht kontaktiert" />
        <KpiCard label="In Kontakt" value={formatNumber(kpi.in_kontakt as number)} hint="kontaktiert / interessiert" />
        <KpiCard label="Gewonnen" value={formatNumber(kpi.gewonnen as number)} hint="angeworben" accent />
      </div>

      <DataTable
        tableId="anwerbung"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Firma, Ansprechpartner oder Ort…"
        emptyTitle="Noch keine Leads"
        emptyDescription="Lege den ersten anzuwerbenden Betrieb über „Unternehmen anwerben“ an."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS[s]?.label ?? s }))}
          />
        }
      />

      {q === "" && (rows.length === 0) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tipp: Verknüpfte E-Mails gehen über denselben Versand wie der Rest (Brevo) und
          werden bei „Senden“ sofort zugestellt.{" "}
          <Link href="/status" className="hover:underline">
            Systemstatus
          </Link>
        </p>
      )}
    </>
  );
}
