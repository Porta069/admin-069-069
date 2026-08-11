import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ENTITY_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { TaskCreateDialog } from "./_components/task-dialog";
import {
  CompleteTaskButton,
  TaskRowActions,
} from "./_components/task-row-actions";

const TABS = [
  { key: "meine", label: "Meine Aufgaben" },
  { key: "team", label: "Team" },
  { key: "ueberfaellig", label: "Überfällig" },
] as const;

const COLUMNS: DataTableColumn[] = [
  { key: "done", label: "", className: "w-10" },
  { key: "title", label: "Titel" },
  { key: "entity", label: "Verknüpfung" },
  { key: "assignee", label: "Zugewiesen an" },
  { key: "due", label: "Fälligkeit", sortable: true },
  { key: "priority", label: "Priorität", sortable: true },
  { key: "status", label: "Status" },
  { key: "created", label: "Erstellt", sortable: true, defaultHidden: true },
  { key: "actions", label: "", className: "w-10" },
];

export default async function AufgabenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("tasks");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "due",
    dir: "asc",
  });
  const tab =
    TABS.find((t) => t.key === firstParam(params.tab))?.key ?? "meine";
  const prioFilter = firstParam(params.prio);
  const statusFilter = firstParam(params.status);
  const maFilter = firstParam(params.ma);
  const initialOpen = firstParam(params.neu) === "1";

  const orderBy = safeSort(
    sort,
    {
      due: "t.due_at",
      priority:
        "case t.priority when 'DRINGEND' then 0 when 'HOCH' then 1 when 'NORMAL' then 2 else 3 end",
      created: "t.created_at",
    },
    "t.due_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const tabFilter =
    tab === "meine"
      ? sql`and t.assignee_id = ${employee.id}`
      : tab === "ueberfaellig"
        ? sql`and t.due_at < now() and t.status in ('OPEN','IN_PROGRESS')`
        : sql``;

  const where = sql`
    t.deleted_at is null
    ${tabFilter}
    ${q ? sql`and (t.title ilike ${like} or t.description ilike ${like})` : sql``}
    ${prioFilter ? sql`and t.priority = ${prioFilter}` : sql``}
    ${statusFilter ? sql`and t.status = ${statusFilter}` : sql``}
    ${maFilter ? sql`and t.assignee_id = ${maFilter}` : sql``}`;

  const [rows, [{ count }], [kpi], employees] = await Promise.all([
    sql`
      select t.*, e.name as assignee_name, e.avatar_color as assignee_color,
        (t.due_at < now() and t.status in ('OPEN','IN_PROGRESS')) as is_overdue
      from admin.task t
      left join admin.employee e on e.id = t.assignee_id
      where ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last,
        t.created_at desc
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int as count from admin.task t where ${where}`,
    sql`
      select
        count(*) filter (where status in ('OPEN','IN_PROGRESS'))::int as open,
        count(*) filter (where due_at < now() and status in ('OPEN','IN_PROGRESS'))::int as overdue,
        count(*) filter (where due_at::date = current_date and status in ('OPEN','IN_PROGRESS'))::int as due_today,
        count(*) filter (where status = 'DONE' and completed_at > now() - interval '30 days')::int as done_30d
      from admin.task
      where deleted_at is null`,
    sql`
      select id, name from admin.employee
      where status = 'ACTIVE' and deleted_at is null
      order by name`,
  ]);

  const canDelete = can(employee, "tasks", "delete");

  const tableRows: DataTableRow[] = rows.map((t) => {
    const overdue = Boolean(t.is_overdue);
    const entityType = t.entity_type as EntityType | null;
    return {
      id: t.id as string,
      cells: {
        done: (
          <CompleteTaskButton
            taskId={t.id as string}
            done={t.status === "DONE"}
          />
        ),
        title: (
          <div className="min-w-0 max-w-md">
            <p
              className={cn(
                "truncate font-medium",
                t.status === "DONE" && "text-muted-foreground line-through",
              )}
            >
              {t.title as string}
            </p>
            {t.description ? (
              <p className="truncate text-xs text-muted-foreground">
                {t.description as string}
              </p>
            ) : null}
          </div>
        ),
        entity:
          entityType && t.entity_id ? (
            <Link
              href={entityHref(entityType, t.entity_id as string)}
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-accent">
                {ENTITY_LABELS[entityType] ?? entityType}
              </Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        assignee: t.assignee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={t.assignee_name as string}
              color={t.assignee_color as string}
              size="sm"
            />
            <span className="text-sm">{t.assignee_name as string}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Nicht zugewiesen</span>
        ),
        due: t.due_at ? (
          <span
            className={cn(
              "text-sm tabular whitespace-nowrap",
              overdue && "font-medium text-destructive",
            )}
          >
            {formatDateTime(t.due_at as string)}
            {overdue ? (
              <span className="block text-xs font-normal">
                überfällig · {formatRelative(t.due_at as string)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
        priority: <PriorityBadge value={t.priority as string} />,
        status: <StatusBadge map={TASK_STATUS} value={t.status as string} />,
        created: (
          <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
            {formatDateTime(t.created_at as string)}
          </span>
        ),
        actions: (
          <TaskRowActions taskId={t.id as string} canDelete={canDelete} />
        ),
      },
    };
  });

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "meine") p.set("tab", key);
    const s = p.toString();
    return s ? `/aufgaben?${s}` : "/aufgaben";
  };

  return (
    <>
      <PageHeader
        title="Aufgaben"
        description="Team-Aufgaben planen, zuweisen und nachhalten."
        actions={
          <TaskCreateDialog
            employees={employees.map((e) => ({
              id: e.id as string,
              name: e.name as string,
            }))}
            currentEmployeeId={employee.id}
            initialOpen={initialOpen}
          />
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Offen" value={kpi.open as number} />
        <KpiCard
          label="Überfällig"
          value={kpi.overdue as number}
          className={(kpi.overdue as number) > 0 ? "border-destructive/40" : undefined}
          hint={(kpi.overdue as number) > 0 ? "Handlungsbedarf" : undefined}
          accent={(kpi.overdue as number) > 0}
        />
        <KpiCard label="Heute fällig" value={kpi.due_today as number} />
        <KpiCard label="Erledigt (30 Tage)" value={kpi.done_30d as number} />
      </div>

      <div className="mb-4 inline-flex items-center gap-1 rounded-lg border bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <DataTable
        tableId="aufgaben"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Aufgaben durchsuchen…"
        emptyTitle="Keine Aufgaben gefunden"
        emptyDescription={
          tab === "ueberfaellig"
            ? "Aktuell ist nichts überfällig — sehr gut."
            : "Erstelle eine neue Aufgabe, um loszulegen."
        }
        toolbar={
          <>
            <FilterSelect
              param="prio"
              placeholder="Alle Prioritäten"
              options={PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_LABELS[p],
              }))}
            />
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={Object.entries(TASK_STATUS).map(([value, def]) => ({
                value,
                label: def.label,
              }))}
            />
            <FilterSelect
              param="ma"
              placeholder="Alle Mitarbeiter"
              options={employees.map((e) => ({
                value: e.id as string,
                label: e.name as string,
              }))}
            />
          </>
        }
      />
    </>
  );
}
