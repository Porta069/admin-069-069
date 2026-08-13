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
  type StatusDef,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Lock, PhoneCall } from "lucide-react";
import { TaskCreateDialog } from "./_components/task-dialog";
import {
  AppointmentRowActions,
  CompleteAppointmentButton,
  CompleteTaskButton,
  TaskRowActions,
} from "./_components/task-row-actions";
import { ProtokollSection } from "./_components/protokoll-section";

const BASE_TABS = [
  { key: "meine", label: "Meine Aufgaben" },
  { key: "bewerbungen", label: "Bewerbungen" },
  { key: "team", label: "Team" },
  { key: "ueberfaellig", label: "Überfällig" },
] as const;

const PROTOKOLL_TAB = { key: "protokoll", label: "Protokoll" } as const;

/** Termine in den Aufgabenlisten: PLANNED→Offen, DONE→Erledigt, CANCELLED→Abgebrochen. */
const APPOINTMENT_LIST_STATUS: Record<string, StatusDef> = {
  OPEN: { label: "Offen", tone: "info" },
  DONE: { label: "Erledigt", tone: "success" },
  CANCELLED: { label: "Abgebrochen", tone: "neutral" },
  MISSED: { label: "Verpasst", tone: "danger" },
};

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
  const isSuperadmin = employee.roleId === "SUPERADMIN";
  const tabs = isSuperadmin ? [...BASE_TABS, PROTOKOLL_TAB] : [...BASE_TABS];

  const requestedTab = firstParam(params.tab);
  // Default ohne Params: „Meine Aufgaben".
  const tab = tabs.find((t) => t.key === requestedTab)?.key ?? "meine";
  const initialOpen = firstParam(params.neu) === "1";

  const [employees] = await Promise.all([
    sql`
      select id, name from admin.employee
      where status = 'ACTIVE' and deleted_at is null
      order by name`,
  ]);

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "meine") p.set("tab", key);
    const s = p.toString();
    return s ? `/aufgaben?${s}` : "/aufgaben";
  };

  const header = (
    <PageHeader
      title="Aufgaben"
      description="Aufgaben und Termine planen, zuweisen und nachhalten."
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
  );

  const tabBar = (
    <div className="mb-5 inline-flex items-center gap-1 rounded-lg border bg-card p-1">
      {tabs.map((t) => (
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
  );

  // Direktaufruf des Protokolls ohne Superadmin-Rolle → klarer Hinweis.
  if (requestedTab === "protokoll" && !isSuperadmin) {
    return (
      <>
        {header}
        {tabBar}
        <EmptyState
          icon={Lock}
          title="Nur für das Master-Konto"
          description="Das Protokoll aller Erledigungen ist dem Superadmin-Konto vorbehalten."
        />
      </>
    );
  }

  if (tab === "protokoll") {
    return (
      <>
        {header}
        {tabBar}
        <ProtokollSection params={params} />
      </>
    );
  }

  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "due",
    dir: "asc",
  });
  const prioFilter = firstParam(params.prio);
  const statusFilter = firstParam(params.status);
  const maFilter = firstParam(params.ma);

  const orderBy = safeSort(
    sort,
    {
      due: "i.due_at",
      priority:
        "case i.priority when 'DRINGEND' then 0 when 'HOCH' then 1 when 'NORMAL' then 2 when 'NIEDRIG' then 3 else 4 end",
      created: "i.created_at",
    },
    "i.due_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const taskWhere = sql`
    t.deleted_at is null
    ${tab === "meine" ? sql`and t.assignee_id = ${employee.id}` : sql``}
    ${tab === "bewerbungen" ? sql`and t.entity_type = 'application'` : sql``}
    ${tab === "ueberfaellig" ? sql`and t.due_at < now() and t.status in ('OPEN','IN_PROGRESS')` : sql``}
    ${q ? sql`and (t.title ilike ${like} or t.description ilike ${like})` : sql``}
    ${prioFilter ? sql`and t.priority = ${prioFilter}` : sql``}
    ${statusFilter ? sql`and t.status = ${statusFilter}` : sql``}
    ${maFilter ? sql`and t.assignee_id = ${maFilter}` : sql``}`;

  // Termin-Status wird auf Aufgaben-Status gemappt (PLANNED→OPEN);
  // „In Arbeit" und Prioritäten gibt es bei Terminen nicht.
  const apptWhere = sql`
    a.deleted_at is null
    ${tab === "meine" ? sql`and a.employee_id = ${employee.id}` : sql``}
    ${tab === "bewerbungen" ? sql`and a.entity_type = 'application'` : sql``}
    ${tab === "ueberfaellig" ? sql`and a.ends_at < now() and a.status = 'PLANNED'` : sql``}
    ${q ? sql`and (a.title ilike ${like} or a.description ilike ${like})` : sql``}
    ${prioFilter ? sql`and false` : sql``}
    ${
      statusFilter
        ? statusFilter === "IN_PROGRESS"
          ? sql`and false`
          : sql`and a.status = ${statusFilter === "OPEN" ? "PLANNED" : statusFilter}`
        : sql``
    }
    ${maFilter ? sql`and a.employee_id = ${maFilter}` : sql``}`;

  // Aufgaben + Termine als UNION in einer Quelle, damit Sortierung,
  // Pagination und Zählung über beide Typen hinweg korrekt sind.
  const itemsCte = sql`
    select t.id::text as id, 'task' as kind, t.title, t.description,
           t.assignee_id, t.due_at, t.priority::text as priority,
           t.status::text as status, t.entity_type, t.entity_id, t.created_at,
           (t.due_at < now() and t.status in ('OPEN','IN_PROGRESS')) as is_overdue
    from admin.task t
    where ${taskWhere}
    union all
    select a.id::text, 'appointment', a.title, a.description,
           a.employee_id, a.starts_at, null::text,
           case a.status::text when 'PLANNED' then 'OPEN' else a.status::text end,
           a.entity_type, a.entity_id, a.starts_at,
           (a.ends_at < now() and a.status = 'PLANNED')
    from admin.appointment a
    where ${apptWhere}`;

  const [rows, [{ count }], [kpi]] = await Promise.all([
    sql`
      with items as (${itemsCte})
      select i.*, e.name as assignee_name, e.avatar_color as assignee_color
      from items i
      left join admin.employee e on e.id = i.assignee_id
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last,
        i.created_at desc
      limit ${pageSize} offset ${offset}`,
    sql`with items as (${itemsCte}) select count(*)::int as count from items`,
    sql`
      select
        (select count(*) from admin.task
         where deleted_at is null and status in ('OPEN','IN_PROGRESS'))::int as task_open,
        (select count(*) from admin.appointment
         where deleted_at is null and status = 'PLANNED')::int as appt_open,
        (select count(*) from admin.task
         where deleted_at is null and due_at < now()
           and status in ('OPEN','IN_PROGRESS'))::int as task_overdue,
        (select count(*) from admin.appointment
         where deleted_at is null and ends_at < now()
           and status = 'PLANNED')::int as appt_overdue,
        (select count(*) from admin.task
         where deleted_at is null and due_at::date = current_date
           and status in ('OPEN','IN_PROGRESS'))::int as task_today,
        (select count(*) from admin.appointment
         where deleted_at is null and starts_at::date = current_date
           and status = 'PLANNED')::int as appt_today,
        (select count(*) from admin.task
         where deleted_at is null and status = 'DONE'
           and completed_at > now() - interval '30 days')::int as task_done30,
        (select count(*) from admin.appointment
         where deleted_at is null and status = 'DONE'
           and starts_at > now() - interval '30 days')::int as appt_done30`,
  ]);

  const canDelete = can(employee, "tasks", "delete");
  const canCompleteAppt = can(employee, "calendar", "edit");

  const tableRows: DataTableRow[] = rows.map((r) => {
    const isTask = r.kind === "task";
    const overdue = Boolean(r.is_overdue);
    const done = r.status === "DONE";
    const entityType = r.entity_type as EntityType | null;
    // Anruf-Aufgaben nach Neuregistrierung → direkt ins Anruf-Interface.
    const isCallTask =
      isTask &&
      entityType === "candidate" &&
      r.entity_id != null &&
      typeof r.title === "string" &&
      r.title.startsWith("Neuregistrierung anrufen:");
    return {
      id: `${r.kind}-${r.id}`,
      cells: {
        done: isTask ? (
          <CompleteTaskButton taskId={r.id as string} done={done} />
        ) : (
          <CompleteAppointmentButton
            appointmentId={r.id as string}
            status={r.status as string}
            canComplete={canCompleteAppt}
          />
        ),
        title: (
          <div className="min-w-0 max-w-md">
            {isCallTask ? (
              <Link
                href={`/kandidaten/${r.entity_id}/anruf?task=${r.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 truncate font-medium text-primary hover:underline",
                  done && "text-muted-foreground line-through",
                )}
              >
                <PhoneCall className="size-3.5 shrink-0" />
                {r.title as string}
              </Link>
            ) : (
              <p
                className={cn(
                  "truncate font-medium",
                  done && "text-muted-foreground line-through",
                )}
              >
                {r.title as string}
              </p>
            )}
            {r.description ? (
              <p className="truncate text-xs text-muted-foreground">
                {r.description as string}
              </p>
            ) : null}
          </div>
        ),
        entity:
          entityType && r.entity_id ? (
            <Link
              href={entityHref(entityType, r.entity_id as string)}
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-accent">
                {ENTITY_LABELS[entityType] ?? entityType}
              </Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        assignee: r.assignee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={r.assignee_name as string}
              color={r.assignee_color as string}
              size="sm"
            />
            <span className="text-sm">{r.assignee_name as string}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Nicht zugewiesen</span>
        ),
        due: r.due_at ? (
          <span
            className={cn(
              "text-sm tabular whitespace-nowrap",
              overdue && "font-medium text-destructive",
            )}
          >
            {formatDateTime(r.due_at as string)}
            {overdue ? (
              <span className="block text-xs font-normal">
                {isTask ? "überfällig" : "verpasst"} ·{" "}
                {formatRelative(r.due_at as string)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
        priority: isTask ? (
          <PriorityBadge value={r.priority as string} />
        ) : (
          <Badge className="border-transparent bg-accent text-accent-foreground">
            <CalendarDays className="size-3" />
            Termin
          </Badge>
        ),
        status: isTask ? (
          <StatusBadge map={TASK_STATUS} value={r.status as string} />
        ) : (
          <StatusBadge
            map={APPOINTMENT_LIST_STATUS}
            value={overdue ? "MISSED" : (r.status as string)}
          />
        ),
        created: (
          <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
            {formatDateTime(r.created_at as string)}
          </span>
        ),
        actions: isTask ? (
          <TaskRowActions taskId={r.id as string} canDelete={canDelete} />
        ) : (
          <AppointmentRowActions
            appointmentId={r.id as string}
            isPlanned={r.status === "OPEN"}
            canComplete={canCompleteAppt}
          />
        ),
      },
    };
  });

  const openTotal = (kpi.task_open as number) + (kpi.appt_open as number);
  const overdueTotal =
    (kpi.task_overdue as number) + (kpi.appt_overdue as number);
  const todayTotal = (kpi.task_today as number) + (kpi.appt_today as number);
  const done30Total = (kpi.task_done30 as number) + (kpi.appt_done30 as number);
  const apptHint = (n: number) => (n > 0 ? `davon ${n} Termine` : undefined);

  return (
    <>
      {header}
      {tabBar}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Offen"
          value={openTotal}
          hint={apptHint(kpi.appt_open as number)}
        />
        <KpiCard
          label="Überfällig"
          value={overdueTotal}
          className={overdueTotal > 0 ? "border-destructive/40" : undefined}
          hint={apptHint(kpi.appt_overdue as number) ?? (overdueTotal > 0 ? "Handlungsbedarf" : undefined)}
          accent={overdueTotal > 0}
        />
        <KpiCard
          label="Heute fällig"
          value={todayTotal}
          hint={apptHint(kpi.appt_today as number)}
        />
        <KpiCard
          label="Erledigt (30 Tage)"
          value={done30Total}
          hint={apptHint(kpi.appt_done30 as number)}
        />
      </div>

      <DataTable
        tableId="aufgaben"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Aufgaben & Termine durchsuchen…"
        emptyTitle="Keine Aufgaben oder Termine gefunden"
        emptyDescription={
          tab === "ueberfaellig"
            ? "Aktuell ist nichts überfällig — sehr gut."
            : tab === "bewerbungen"
              ? "Sobald eine neue Bewerbung eingeht, erscheint hier automatisch eine Anruf-Aufgabe."
              : tab === "meine"
                ? "Dir ist aktuell nichts zugewiesen. Erstelle eine neue Aufgabe, um loszulegen."
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
