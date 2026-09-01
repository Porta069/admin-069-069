import { Eye } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { LEAD_STATUS, LEAD_STATUSES, LEAD_PIPELINE } from "./lead-defs";
import {
  AddLeadDialog,
  ArchiveLeadButton,
  LeadEmailButton,
  LeadStatusSelect,
} from "./_components/lead-actions";
import { AnsichtToggle } from "./_components/ansicht-toggle";
import { LeadBoard, type LeadColumn } from "./_components/lead-board";
import { LeadDetail, type Lead } from "./_components/lead-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unternehmens-Anwerbung" };

const COLUMNS: DataTableColumn[] = [
  { key: "firma", label: "Unternehmen", sortable: true },
  { key: "kontakt", label: "Kontakt" },
  { key: "ort", label: "Ort" },
  { key: "status", label: "Status" },
  { key: "termin", label: "Systemvorstellung" },
  { key: "kontaktiert", label: "Letzter Kontakt", sortable: true },
  { key: "zustaendig", label: "Zuständig" },
  { key: "aktion", label: "" },
];

/** DB-Zeile → Lead (für Board-Karten und Detail-Dialog). */
function toLead(r: Record<string, unknown>): Lead {
  return {
    id: r.id as string,
    name: r.name as string,
    ansprechpartner: (r.ansprechpartner as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    ort: (r.ort as string | null) ?? null,
    website: (r.website as string | null) ?? null,
    status: r.status as string,
    termin_at: r.termin_at ? new Date(r.termin_at as string).toISOString() : null,
    vertrag_at: r.vertrag_at ? new Date(r.vertrag_at as string).toISOString() : null,
    company_id: (r.company_id as string | null) ?? null,
    assignee_name: (r.assignee_name as string | null) ?? null,
    assignee_color: (r.avatar_color as string | null) ?? null,
  };
}

export default async function AnwerbungPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("companies");
  const params = await searchParams;
  const ansicht = firstParam(params.ansicht) === "tabelle" ? "tabelle" : "board";
  const canCreate = can(employee, "companies", "create");
  const canEdit = can(employee, "companies", "edit");

  const [[kpi], employees] = await Promise.all([
    sql`
      select
        count(*) filter (where deleted_at is null)::int as offen,
        count(*) filter (where deleted_at is null and status = 'NEU')::int as neu,
        count(*) filter (where deleted_at is null and status in ('KONTAKTIERT','INTERESSIERT','SYSTEMVORSTELLUNG','VERTRAG'))::int as in_pipeline,
        count(*) filter (where deleted_at is null and status = 'GEWONNEN')::int as gewonnen
      from admin.company_lead`,
    sql`select id, name from admin.employee where status = 'ACTIVE' and deleted_at is null order by name`,
  ]);
  const empList = employees.map((e) => ({ id: e.id as string, name: e.name as string }));

  return (
    <>
      <PageHeader
        title="Unternehmens-Anwerbung"
        description="Betriebe anwerben, die noch nicht auf der Plattform sind — von Erstkontakt über Systemvorstellung und Vertrag bis zum Job-Inserat."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AnsichtToggle value={ansicht} />
            {canCreate ? <AddLeadDialog employees={empList} /> : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Offene Leads" value={formatNumber(kpi.offen as number)} hint="nicht archiviert" />
        <KpiCard label="Neu" value={formatNumber(kpi.neu as number)} hint="noch nicht kontaktiert" />
        <KpiCard label="In Pipeline" value={formatNumber(kpi.in_pipeline as number)} hint="Kontakt bis Vertrag" />
        <KpiCard label="Gewonnen" value={formatNumber(kpi.gewonnen as number)} hint="angeworben" accent />
      </div>

      {ansicht === "board" ? (
        <BoardAnsicht canEdit={canEdit} />
      ) : (
        <TabelleAnsicht params={params} canEdit={canEdit} />
      )}
    </>
  );
}

/** Pipeline-Board: pro Status bis zu 40 Karten + Gesamtzahl. */
async function BoardAnsicht({ canEdit }: { canEdit: boolean }) {
  const rows = await sql`
    with base as (
      select l.*, e.name as assignee_name, e.avatar_color,
        row_number() over (partition by l.status order by l.updated_at desc) as rn,
        count(*) over (partition by l.status)::int as total
      from admin.company_lead l
      left join admin.employee e on e.id = l.assignee_id
      where l.deleted_at is null
    )
    select * from base where rn <= 40`;

  const columns: LeadColumn[] = LEAD_PIPELINE.map((status) => {
    const inCol = rows.filter((r) => r.status === status);
    return {
      status,
      count: (inCol[0]?.total as number) ?? 0,
      cards: inCol.map(toLead),
    };
  });

  return <LeadBoard columns={columns} canEdit={canEdit} />;
}

/** Tabellen-Ansicht: paginiert, filter-/sortierbar. */
async function TabelleAnsicht({
  params,
  canEdit,
}: {
  params: SearchParams;
  canEdit: boolean;
}) {
  const { page, pageSize, q, sort, dir } = readTableParams(params, { sort: "erstellt" });
  const status = firstParam(params.status);
  const orderBy = safeSort(
    sort,
    { firma: "name", kontaktiert: "last_contacted_at", erstellt: "created_at" },
    "created_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, [{ count }]] = await Promise.all([
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
  ]);

  const tableRows: DataTableRow[] = rows.map((r) => {
    const lead = toLead(r);
    return {
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
        termin: r.termin_at ? (
          <span className="tabular">{formatDate(r.termin_at as string)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
        aktion: (
          <span className="flex items-center justify-end gap-0.5">
            <LeadDetail lead={lead} canEdit={canEdit}>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Details">
                <Eye className="size-4" />
              </Button>
            </LeadDetail>
            {canEdit ? (
              <>
                <LeadEmailButton
                  id={r.id as string}
                  name={r.name as string}
                  ansprechpartner={(r.ansprechpartner as string | null) ?? null}
                  email={(r.email as string | null) ?? null}
                />
                <ArchiveLeadButton id={r.id as string} />
              </>
            ) : null}
          </span>
        ),
      },
    };
  });

  return (
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
  );
}
