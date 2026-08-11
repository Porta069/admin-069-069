import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate } from "@/lib/format";
import {
  CANDIDATE_STATUS,
  APPLICATION_STATUS,
  PRIORITIES,
  PRIORITY_LABELS,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  type BulkAction,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Button } from "@/components/ui/button";
import { BadgeCheck, SquareKanban, Table2 } from "lucide-react";
import { ExportButton } from "../_shared/export-button";
import { CandidateKanban, type KanbanColumnData } from "./_components/kanban";
import {
  bulkAssignToMe,
  bulkSetPriorityHoch,
  bulkSetStatusGeprueft,
  updateCandidateStatus,
} from "./actions";

const PIPELINE_ORDER = [
  "NEU",
  "IN_BEARBEITUNG",
  "GEPRUEFT",
  "MATCHING",
  "VORGESCHLAGEN",
  "BEWERBUNG",
  "INTERVIEW",
  "ZUSAGE",
  "VERMITTELT",
  "ABGELEHNT",
  "INAKTIV",
];

const INTENT_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv suchend",
  PASSIVE: "Passiv",
};

interface CandidateRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profession: string | null;
  federalState: string | null;
  birthYear: number | null;
  availability: string | null;
  searchIntent: string | null;
  status: string;
  verified: boolean;
  createdAt: Date;
  retentionUntil: Date | null;
  pipeline_status: string | null;
  priority: string | null;
  assignee_name: string | null;
  assignee_color: string | null;
}

interface KanbanRow {
  id: string;
  firstName: string;
  lastName: string;
  profession: string | null;
  federalState: string | null;
  pipeline_status: string;
  priority: string | null;
  assignee_name: string | null;
  assignee_color: string | null;
  total: number;
}

const COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "beruf", label: "Beruf" },
  { key: "bundesland", label: "Bundesland" },
  { key: "alter", label: "Alter", className: "tabular" },
  { key: "verfuegbarkeit", label: "Verfügbarkeit", defaultHidden: true },
  { key: "intention", label: "Suchintention", defaultHidden: true },
  { key: "plattform", label: "Plattform-Status" },
  { key: "pipeline", label: "Pipeline-Status" },
  { key: "prioritaet", label: "Priorität" },
  { key: "mitarbeiter", label: "Zuständig" },
  { key: "registriert", label: "Registriert", sortable: true },
  { key: "verifiziert", label: "Verifiziert" },
  { key: "frist", label: "Frist", defaultHidden: true },
];

/** Aufbewahrungsfrist läuft in weniger als 60 Tagen ab? */
function retentionCritical(retentionUntil: Date | string | null): boolean {
  if (!retentionUntil) return false;
  const until = new Date(retentionUntil).getTime();
  return until - Date.now() < 60 * 24 * 60 * 60 * 1000;
}

export default async function KandidatenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("candidates");
  const params = await searchParams;
  const view = firstParam(params.ansicht) === "kanban" ? "kanban" : "tabelle";
  const canExport = can(employee, "candidates", "export");

  const toggle = (
    <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
      <Button
        asChild
        variant={view === "tabelle" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2.5"
      >
        <Link href="/kandidaten">
          <Table2 className="size-3.5" />
          Tabelle
        </Link>
      </Button>
      <Button
        asChild
        variant={view === "kanban" ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2.5"
      >
        <Link href="/kandidaten?ansicht=kanban">
          <SquareKanban className="size-3.5" />
          Kanban
        </Link>
      </Button>
    </div>
  );

  if (view === "kanban") {
    const rows = await sql<KanbanRow[]>`
      with base as (
        select a.id, a."firstName", a."lastName", a.profession, a."federalState",
               coalesce(cm.status, 'NEU') as pipeline_status,
               coalesce(cm.priority, 'NORMAL') as priority,
               e.name as assignee_name, e.avatar_color as assignee_color,
               row_number() over (
                 partition by coalesce(cm.status, 'NEU')
                 order by a."createdAt" desc
               ) as rn,
               (count(*) over (partition by coalesce(cm.status, 'NEU')))::int as total
        from public."Application" a
        left join admin.candidate_meta cm on cm.application_id = a.id
        left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
        where a.status <> 'ERASED'
      )
      select id, "firstName", "lastName", profession, "federalState",
             pipeline_status, priority, assignee_name, assignee_color, total
      from base where rn <= 30`;

    const columns: KanbanColumnData[] = PIPELINE_ORDER.map((status) => {
      const inColumn = rows.filter((r) => r.pipeline_status === status);
      return {
        status,
        count: inColumn[0]?.total ?? 0,
        cards: inColumn.map((r) => ({
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          profession: r.profession,
          federalState: r.federalState,
          priority: r.priority ?? "NORMAL",
          assigneeName: r.assignee_name,
          assigneeColor: r.assignee_color,
        })),
      };
    });

    return (
      <>
        <PageHeader
          title="Kandidaten"
          description="Pipeline-Board — Karten per Drag & Drop zwischen Status verschieben."
          actions={
            <>
              {canExport && <ExportButton modul="kandidaten" />}
              {toggle}
            </>
          }
        />
        <CandidateKanban
          columns={columns}
          action={updateCandidateStatus}
          canEdit={can(employee, "candidates", "edit")}
        />
      </>
    );
  }

  // ── Tabellen-Ansicht ────────────────────────────────────────────────────
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "registriert",
  });
  const status = firstParam(params.status);
  const bundesland = firstParam(params.bundesland);
  const beruf = firstParam(params.beruf);
  const prio = firstParam(params.prio);
  const verifiziert = firstParam(params.verifiziert);
  const tag = firstParam(params.tag);

  const orderBy = safeSort(
    sort,
    { name: `a."lastName"`, registriert: `a."createdAt"` },
    `a."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
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
    }`;

  const [rows, countRows, bundeslaender, berufe, tagOptions] = await Promise.all([
    sql<CandidateRow[]>`
      select a.id, a."firstName", a."lastName", a.email, a.profession,
             a."federalState", a."birthYear", a.availability,
             a."searchIntent"::text as "searchIntent", a.status::text as status,
             a.verified, a."createdAt", a."retentionUntil",
             cm.status as pipeline_status, cm.priority,
             e.name as assignee_name, e.avatar_color as assignee_color
      from public."Application" a
      left join admin.candidate_meta cm on cm.application_id = a.id
      left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
      ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql<{ count: number }[]>`
      select count(*)::int as count
      from public."Application" a
      left join admin.candidate_meta cm on cm.application_id = a.id
      ${where}`,
    sql<{ federalState: string }[]>`
      select distinct "federalState" from public."Application"
      where status <> 'ERASED' and "federalState" is not null
      order by 1 limit 30`,
    sql<{ profession: string }[]>`
      select profession from public."Application"
      where status <> 'ERASED' and profession is not null
      group by profession order by count(*) desc limit 30`,
    sql<{ name: string }[]>`
      select name from admin.tag order by name asc limit 100`,
  ]);
  const count = countRows[0]?.count ?? 0;

  const currentYear = new Date().getFullYear();
  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id,
    href: `/kandidaten/${r.id}`,
    cells: {
      name: (
        <span className="font-medium">
          {r.firstName} {r.lastName}
        </span>
      ),
      beruf: r.profession ?? "—",
      bundesland: r.federalState ?? "—",
      alter: r.birthYear ? currentYear - r.birthYear : "—",
      verfuegbarkeit: r.availability ?? "—",
      intention: r.searchIntent ? (INTENT_LABELS[r.searchIntent] ?? r.searchIntent) : "—",
      plattform: <StatusBadge map={APPLICATION_STATUS} value={r.status} />,
      pipeline: (
        <StatusBadge map={CANDIDATE_STATUS} value={r.pipeline_status ?? "NEU"} />
      ),
      prioritaet: <PriorityBadge value={r.priority} />,
      mitarbeiter: r.assignee_name ? (
        <span className="flex items-center gap-2">
          <EmployeeAvatar name={r.assignee_name} color={r.assignee_color} size="sm" />
          <span className="truncate">{r.assignee_name}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      registriert: <span className="tabular">{formatDate(r.createdAt)}</span>,
      verifiziert: r.verified ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
          <BadgeCheck className="size-3.5" />
          Ja
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Nein</span>
      ),
      frist: r.retentionUntil ? (
        <span
          className={
            retentionCritical(r.retentionUntil)
              ? "font-medium text-destructive tabular"
              : "tabular"
          }
        >
          {formatDate(r.retentionUntil)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    },
  }));

  const canEdit = can(employee, "candidates", "edit");
  const canAssign = can(employee, "candidates", "assign");
  const bulkActions: BulkAction[] = [
    ...(canEdit
      ? [{ label: "Status: Geprüft", action: bulkSetStatusGeprueft }]
      : []),
    ...(canAssign ? [{ label: "Mir zuweisen", action: bulkAssignToMe }] : []),
    ...(canEdit
      ? [{ label: "Priorität: Hoch", action: bulkSetPriorityHoch }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Kandidaten"
        description="Alle registrierten Handwerker — Pipeline, Zuständigkeiten und Priorisierung."
        actions={
          <>
            {canExport && <ExportButton modul="kandidaten" />}
            {toggle}
          </>
        }
      />
      <DataTable
        tableId="kandidaten"
        columns={COLUMNS}
        rows={tableRows}
        total={count}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Name, E-Mail oder Beruf…"
        emptyTitle="Keine Kandidaten gefunden"
        emptyDescription="Sobald sich Handwerker registrieren, erscheinen sie hier. Filter prüfen oder Suchbegriff anpassen."
        bulkActions={bulkActions.length > 0 ? bulkActions : undefined}
        toolbar={
          <>
            <FilterSelect
              param="status"
              placeholder="Alle Pipeline-Status"
              options={PIPELINE_ORDER.map((s) => ({
                value: s,
                label: CANDIDATE_STATUS[s]?.label ?? s,
              }))}
            />
            <FilterSelect
              param="bundesland"
              placeholder="Alle Bundesländer"
              options={bundeslaender.map((b) => ({
                value: b.federalState,
                label: b.federalState,
              }))}
              className="h-9 w-40 bg-card"
            />
            <FilterSelect
              param="beruf"
              placeholder="Alle Berufe"
              options={berufe.map((b) => ({
                value: b.profession,
                label: b.profession,
              }))}
              className="h-9 w-40 bg-card"
            />
            <FilterSelect
              param="prio"
              placeholder="Alle Prioritäten"
              options={PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABELS[p],
              }))}
              className="h-9 w-40 bg-card"
            />
            <FilterSelect
              param="verifiziert"
              placeholder="Verifiziert: alle"
              options={[
                { value: "ja", label: "Verifiziert" },
                { value: "nein", label: "Nicht verifiziert" },
              ]}
              className="h-9 w-40 bg-card"
            />
            {tagOptions.length > 0 && (
              <FilterSelect
                param="tag"
                placeholder="Alle Tags"
                options={tagOptions.map((t) => ({
                  value: t.name,
                  label: t.name,
                }))}
                className="h-9 w-36 bg-card"
              />
            )}
          </>
        }
      />
    </>
  );
}
