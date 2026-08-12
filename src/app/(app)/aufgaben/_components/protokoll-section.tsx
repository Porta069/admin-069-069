import Link from "next/link";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDateTime, parseBerlinLocal } from "@/lib/format";
import {
  ENTITY_LABELS,
  entityHref,
  type EntityType,
  type StatusDef,
} from "@/lib/definitions";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { DateRangeFilter } from "./date-range-filter";

const PROTOKOLL_STATUS: Record<string, StatusDef> = {
  DONE: { label: "Erledigt", tone: "success" },
  CANCELLED: { label: "Abgebrochen", tone: "neutral" },
};

const COLUMNS: DataTableColumn[] = [
  { key: "done", label: "Erledigt am", sortable: true },
  { key: "typ", label: "Typ" },
  { key: "title", label: "Titel" },
  { key: "employee", label: "Mitarbeiter" },
  { key: "entity", label: "Bereich" },
  { key: "status", label: "Status" },
  { key: "duration", label: "Dauer offen → erledigt" },
];

/** Menschlich lesbare Dauer, z. B. "2 Tg. 4 Std." oder "35 Min." */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "unter 1 Min.";
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const restMin = minutes % 60;
    return restMin > 0 ? `${hours} Std. ${restMin} Min.` : `${hours} Std.`;
  }
  const days = Math.floor(hours / 24);
  const restH = hours % 24;
  return restH > 0 ? `${days} Tg. ${restH} Std.` : `${days} Tg.`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = parseBerlinLocal(`${value}T${endOfDay ? "23:59" : "00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Master-Protokoll „Wer hat was erledigt?" — chronologische Liste aller
 * erledigten und abgebrochenen Aufgaben & Termine. Nur für SUPERADMIN;
 * die Rollenprüfung passiert serverseitig in page.tsx.
 */
export async function ProtokollSection({ params }: { params: SearchParams }) {
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "done",
    dir: "desc",
  });
  const maFilter = firstParam(params.ma);
  const typFilter = firstParam(params.typ);
  const vonDate = parseDateParam(firstParam(params.von), false);
  const bisDate = parseDateParam(firstParam(params.bis), true);

  const orderBy = safeSort(sort, { done: "i.done_at" }, "i.done_at");
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const taskWhere = sql`
    t.deleted_at is null and t.status in ('DONE','CANCELLED')
    ${q ? sql`and t.title ilike ${like}` : sql``}
    ${maFilter ? sql`and t.assignee_id = ${maFilter}` : sql``}
    ${typFilter === "appointment" ? sql`and false` : sql``}`;

  const apptWhere = sql`
    a.deleted_at is null and a.status in ('DONE','CANCELLED')
    ${q ? sql`and a.title ilike ${like}` : sql``}
    ${maFilter ? sql`and a.employee_id = ${maFilter}` : sql``}
    ${typFilter === "task" ? sql`and false` : sql``}`;

  // Aufgaben + Termine als UNION, damit Sortierung und Pagination über
  // beide Quellen hinweg korrekt sind. Termine haben kein completed_at —
  // wir nehmen die letzte Audit-Zeit, sonst die Terminzeit (mit Hinweis).
  const itemsCte = sql`
    select t.id::text as id, 'task' as kind, t.title,
           coalesce(t.completed_at, t.updated_at, t.created_at) as done_at,
           false as done_at_estimated,
           t.assignee_id, t.entity_type, t.entity_id, t.status::text as status,
           t.created_at, t.completed_at
    from admin.task t
    where ${taskWhere}
    union all
    select a.id::text, 'appointment', a.title,
           coalesce(au.at, a.starts_at),
           (au.at is null),
           a.employee_id, a.entity_type, a.entity_id, a.status::text,
           null::timestamptz, null::timestamptz
    from admin.appointment a
    left join lateral (
      select max(al.created_at) as at
      from admin.audit_log al
      where al.entity_type = 'appointment'
        and al.entity_id = a.id::text
        and al.action in ('appointment.completed', 'appointment.status_changed')
    ) au on true
    where ${apptWhere}`;

  const rangeWhere = sql`
    true
    ${vonDate ? sql`and i.done_at >= ${vonDate}` : sql``}
    ${bisDate ? sql`and i.done_at <= ${bisDate}` : sql``}`;

  const [rows, [{ count }], [kpi], topRows, employees] = await Promise.all([
    sql`
      with items as (${itemsCte})
      select i.*, e.name as employee_name, e.avatar_color as employee_color
      from items i
      left join admin.employee e on e.id = i.assignee_id
      where ${rangeWhere}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      with items as (${itemsCte})
      select count(*)::int as count from items i where ${rangeWhere}`,
    sql`
      select
        ((select count(*) from admin.task
          where deleted_at is null and status = 'DONE'
            and completed_at > now() - interval '7 days')
         + (select count(*) from admin.appointment
            where deleted_at is null and status = 'DONE'
              and starts_at > now() - interval '7 days'))::int as done_7d,
        ((select count(*) from admin.task
          where deleted_at is null and status = 'DONE'
            and completed_at > now() - interval '30 days')
         + (select count(*) from admin.appointment
            where deleted_at is null and status = 'DONE'
              and starts_at > now() - interval '30 days'))::int as done_30d,
        (select round(avg(extract(epoch from (completed_at - created_at))))
         from admin.task
         where deleted_at is null and status = 'DONE'
           and completed_at is not null
           and completed_at > now() - interval '30 days') as avg_secs`,
    sql`
      select e.name, count(*)::int as cnt
      from (
        select assignee_id as emp_id from admin.task
        where deleted_at is null and status = 'DONE'
          and completed_at > now() - interval '30 days'
        union all
        select employee_id from admin.appointment
        where deleted_at is null and status = 'DONE'
          and starts_at > now() - interval '30 days'
      ) x
      join admin.employee e on e.id = x.emp_id
      group by e.name
      order by cnt desc
      limit 1`,
    sql`
      select id, name from admin.employee
      where status = 'ACTIVE' and deleted_at is null
      order by name`,
  ]);

  const avgSecs = kpi.avg_secs === null ? null : Number(kpi.avg_secs);
  const top = topRows[0];

  const tableRows: DataTableRow[] = rows.map((r) => {
    const isTask = r.kind === "task";
    const entityType = r.entity_type as EntityType | null;
    const durationMs =
      isTask && r.completed_at && r.created_at
        ? new Date(r.completed_at as string).getTime() -
          new Date(r.created_at as string).getTime()
        : null;
    return {
      id: `${r.kind}-${r.id}`,
      cells: {
        done: (
          <span className="text-sm tabular whitespace-nowrap">
            {formatDateTime(r.done_at as string)}
            {r.done_at_estimated ? (
              <span className="block text-xs font-normal text-muted-foreground">
                Terminzeit (kein Audit-Eintrag)
              </span>
            ) : null}
          </span>
        ),
        typ: isTask ? (
          <Badge variant="outline">
            <ClipboardCheck className="size-3" />
            Aufgabe
          </Badge>
        ) : (
          <Badge className="border-transparent bg-accent text-accent-foreground">
            <CalendarDays className="size-3" />
            Termin
          </Badge>
        ),
        title: (
          <span className="block max-w-md truncate font-medium">
            {r.title as string}
          </span>
        ),
        employee: r.employee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={r.employee_name as string}
              color={r.employee_color as string}
              size="sm"
            />
            <span className="text-sm">{r.employee_name as string}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Nicht zugewiesen</span>
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
        status: <StatusBadge map={PROTOKOLL_STATUS} value={r.status as string} />,
        duration:
          durationMs !== null ? (
            <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
              {formatDuration(durationMs)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    };
  });

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Erledigt (7 Tage)" value={kpi.done_7d as number} />
        <KpiCard label="Erledigt (30 Tage)" value={kpi.done_30d as number} />
        <KpiCard
          label="Top-Mitarbeiter (30 Tage)"
          value={top ? (top.name as string) : "—"}
          hint={top ? `${top.cnt} Erledigungen` : "Noch keine Erledigungen"}
        />
        <KpiCard
          label="Ø Bearbeitungsdauer"
          value={avgSecs !== null ? formatDuration(avgSecs * 1000) : "—"}
          hint="Aufgaben, letzte 30 Tage"
        />
      </div>

      <DataTable
        tableId="aufgaben-protokoll"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Protokoll durchsuchen…"
        emptyTitle="Keine Erledigungen gefunden"
        emptyDescription="Im gewählten Zeitraum wurde nichts erledigt oder abgebrochen."
        toolbar={
          <>
            <FilterSelect
              param="ma"
              placeholder="Alle Mitarbeiter"
              options={employees.map((e) => ({
                value: e.id as string,
                label: e.name as string,
              }))}
            />
            <FilterSelect
              param="typ"
              placeholder="Alle Typen"
              className="h-9 w-36 bg-card"
              options={[
                { value: "task", label: "Aufgaben" },
                { value: "appointment", label: "Termine" },
              ]}
            />
            <DateRangeFilter />
          </>
        }
      />
    </>
  );
}
