import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { de } from "date-fns/locale";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";
import {
  ENTITY_LABELS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Users,
} from "lucide-react";
import { AppointmentCreateDialog } from "./_components/appointment-dialog";
import {
  AppointmentItem,
  type AppointmentData,
} from "./_components/appointment-item";
import { TaskItem, type TaskData } from "./_components/task-item";

type View = "monat" | "woche" | "tag";

const DAY_START = 7;
const DAY_END = 20;
const HOUR_PX = 48;

const berlinDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const berlinTimeParts = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function berlinHours(d: Date): number {
  const [h, m] = berlinTimeParts.format(d).split(":").map(Number);
  return h + m / 60;
}

interface AptRow extends AppointmentData {
  startDate: Date;
  endDate: Date;
  entityType: string | null;
  entityId: string | null;
}

/**
 * Klassisches Spalten-Packing (wie Google Calendar): Events nach Start
 * sortieren, transitiv überlappende Events zu Gruppen zusammenfassen,
 * innerhalb der Gruppe greedy die erste freie Spalte vergeben. Jede
 * Gruppe teilt die Breite gleichmäßig — nichts verdeckt sich mehr.
 */
function layoutDay(dayApts: AptRow[]): {
  apt: AptRow;
  top: number;
  height: number;
  left: string;
  width: string;
}[] {
  const evs = dayApts
    .map((apt) => {
      const start = Math.max(berlinHours(apt.startDate), DAY_START);
      const end = Math.min(
        Math.max(berlinHours(apt.endDate), start + 0.4),
        DAY_END,
      );
      return { apt, start, end };
    })
    .filter((e) => e.start < DAY_END)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const out: {
    apt: AptRow;
    top: number;
    height: number;
    left: string;
    width: string;
  }[] = [];
  let group: { ev: (typeof evs)[number]; col: number }[] = [];
  let groupEnd = 0;

  const flush = () => {
    if (group.length === 0) return;
    const cols = Math.max(...group.map((g) => g.col)) + 1;
    for (const g of group) {
      out.push({
        apt: g.ev.apt,
        top: (g.ev.start - DAY_START) * HOUR_PX + 1,
        height: Math.max((g.ev.end - g.ev.start) * HOUR_PX - 2, 18),
        left: `calc(${(g.col / cols) * 100}% + 2px)`,
        width: `calc(${100 / cols}% - 4px)`,
      });
    }
    group = [];
  };

  for (const ev of evs) {
    if (group.length > 0 && ev.start >= groupEnd) flush();
    groupEnd = group.length === 0 ? ev.end : Math.max(groupEnd, ev.end);
    const used = new Set(
      group.filter((g) => g.ev.end > ev.start).map((g) => g.col),
    );
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ev, col });
  }
  flush();
  return out;
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("calendar");
  const params = await searchParams;

  const viewParam = firstParam(params.ansicht);
  const view: View =
    viewParam === "woche" || viewParam === "tag" ? viewParam : "monat";

  const datumParam = firstParam(params.datum);
  let date = new Date();
  if (datumParam && /^\d{4}-\d{2}-\d{2}$/.test(datumParam)) {
    const [y, m, d] = datumParam.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  const initialOpen = firstParam(params.neu) === "1";

  // Team-Ansicht: nur für SUPERADMIN — serverseitig erzwingen.
  const isSuperadmin = employee.roleId === "SUPERADMIN";
  const teamRequested = firstParam(params.team) === "1";
  if (teamRequested && !isSuperadmin) {
    redirect(`/kalender?ansicht=${view}&datum=${format(date, "yyyy-MM-dd")}`);
  }
  const teamView = teamRequested && isSuperadmin;
  const filterId = teamView ? firstParam(params.mitarbeiter) || null : null;

  const weekOpts = { weekStartsOn: 1 as const };
  const rangeStart =
    view === "monat"
      ? startOfWeek(startOfMonth(date), weekOpts)
      : view === "woche"
        ? startOfWeek(date, weekOpts)
        : startOfDay(date);
  const rangeEnd =
    view === "monat"
      ? endOfWeek(endOfMonth(date), weekOpts)
      : view === "woche"
        ? endOfWeek(date, weekOpts)
        : endOfDay(date);

  // Sichtbarkeit: normale Ansicht = eigene Einträge + Termine ohne
  // Zuweisung; Team-Ansicht = alle (optional auf einen Mitarbeiter gefiltert).
  const aptScope = teamView
    ? filterId
      ? sql`and a.employee_id = ${filterId}`
      : sql``
    : sql`and (a.employee_id = ${employee.id} or a.employee_id is null)`;
  const taskScope = teamView
    ? filterId
      ? sql`and t.assignee_id = ${filterId}`
      : sql``
    : sql`and t.assignee_id = ${employee.id}`;

  const [rows, taskRows, upcomingRows, missedRows, overdueTaskRows, employees] =
    await Promise.all([
      sql`
        select a.*, e.name as employee_name, e.avatar_color as employee_color
        from admin.appointment a
        left join admin.employee e on e.id = a.employee_id
        where a.deleted_at is null
          and a.starts_at <= ${rangeEnd} and a.ends_at >= ${rangeStart}
          ${aptScope}
        order by a.starts_at asc
        limit 500`,
      sql`
        select t.id, t.title, t.due_at, t.priority, t.status, t.entity_type, t.entity_id,
               e.name as assignee_name, e.avatar_color as assignee_color
        from admin.task t
        left join admin.employee e on e.id = t.assignee_id
        where t.deleted_at is null
          and t.due_at is not null
          and t.due_at >= ${rangeStart} and t.due_at <= ${rangeEnd}
          ${taskScope}
        order by t.due_at asc
        limit 500`,
      sql`
        select a.*, e.name as employee_name, e.avatar_color as employee_color
        from admin.appointment a
        left join admin.employee e on e.id = a.employee_id
        where a.deleted_at is null and a.status = 'PLANNED' and a.starts_at >= now()
          ${aptScope}
        order by a.starts_at asc
        limit 8`,
      sql`
        select a.*, e.name as employee_name, e.avatar_color as employee_color
        from admin.appointment a
        left join admin.employee e on e.id = a.employee_id
        where a.deleted_at is null and a.status = 'PLANNED' and a.ends_at < now()
          ${aptScope}
        order by a.ends_at desc
        limit 5`,
      sql`
        select t.id, t.title, t.due_at, t.priority, t.status, t.entity_type, t.entity_id,
               e.name as assignee_name, e.avatar_color as assignee_color
        from admin.task t
        left join admin.employee e on e.id = t.assignee_id
        where t.deleted_at is null
          and t.due_at is not null and t.due_at < now()
          and t.status in ('OPEN', 'IN_PROGRESS')
          ${taskScope}
        order by t.due_at asc
        limit 5`,
      sql`
        select id, name, avatar_color from admin.employee
        where status = 'ACTIVE' and deleted_at is null
        order by name`,
    ]);

  const now = new Date();

  const toApt = (r: Record<string, unknown>): AptRow => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    startsAt: (r.starts_at as Date).toISOString(),
    endsAt: (r.ends_at as Date).toISOString(),
    location: (r.location as string) ?? null,
    status: r.status as string,
    employeeName: (r.employee_name as string) ?? null,
    employeeColor: (r.employee_color as string) ?? null,
    entityType: (r.entity_type as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    startDate: r.starts_at as Date,
    endDate: r.ends_at as Date,
    missed: r.status === "PLANNED" && (r.ends_at as Date) < now,
  });

  const toTask = (r: Record<string, unknown>): TaskData => {
    const due = r.due_at as Date;
    const status = r.status as string;
    return {
      id: r.id as string,
      title: r.title as string,
      dueAt: due.toISOString(),
      hasTime: berlinTimeParts.format(due) !== "00:00",
      priority: (r.priority as string) ?? "NORMAL",
      status,
      assigneeName: (r.assignee_name as string) ?? null,
      assigneeColor: (r.assignee_color as string) ?? null,
      entityType: (r.entity_type as string) ?? null,
      entityId: (r.entity_id as string) ?? null,
      overdue: (status === "OPEN" || status === "IN_PROGRESS") && due < now,
    };
  };

  const appointments = rows.map(toApt);
  const upcoming = upcomingRows.map(toApt);
  const missedApts = missedRows.map(toApt);
  const overdueTasks = overdueTaskRows.map(toTask);

  const byDay = new Map<string, AptRow[]>();
  for (const apt of appointments) {
    const key = berlinDayKey.format(apt.startDate);
    const list = byDay.get(key) ?? [];
    list.push(apt);
    byDay.set(key, list);
  }

  const tasksByDay = new Map<string, TaskData[]>();
  let taskCount = 0;
  for (const r of taskRows) {
    const key = berlinDayKey.format(r.due_at as Date);
    const list = tasksByDay.get(key) ?? [];
    list.push(toTask(r));
    tasksByDay.set(key, list);
    taskCount++;
  }

  const canEdit = can(employee, "calendar", "edit");
  const canDelete = can(employee, "calendar", "delete");
  const canCompleteTasks = can(employee, "tasks", "edit");

  const teamEmployees = employees.map((e) => ({
    id: e.id as string,
    name: e.name as string,
    color: (e.avatar_color as string) ?? null,
  }));

  const prevDate =
    view === "monat"
      ? subMonths(date, 1)
      : view === "woche"
        ? subWeeks(date, 1)
        : subDays(date, 1);
  const nextDate =
    view === "monat"
      ? addMonths(date, 1)
      : view === "woche"
        ? addWeeks(date, 1)
        : addDays(date, 1);

  const href = (
    v: View,
    d: Date,
    opts?: { team?: boolean; mitarbeiter?: string | null },
  ) => {
    const p = new URLSearchParams({
      ansicht: v,
      datum: format(d, "yyyy-MM-dd"),
    });
    const t = opts?.team ?? teamView;
    if (t) {
      p.set("team", "1");
      const m = opts && "mitarbeiter" in opts ? opts.mitarbeiter : filterId;
      if (m) p.set("mitarbeiter", m);
    }
    return `/kalender?${p.toString()}`;
  };

  const title =
    view === "monat"
      ? format(date, "MMMM yyyy", { locale: de })
      : view === "woche"
        ? `KW ${format(date, "I", { locale: de })} · ${format(rangeStart, "d. MMM", { locale: de })} – ${format(rangeEnd, "d. MMM yyyy", { locale: de })}`
        : format(date, "EEEE, d. MMMM yyyy", { locale: de });

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const hours = Array.from(
    { length: DAY_END - DAY_START },
    (_, i) => DAY_START + i,
  );

  const renderDayColumn = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    const positioned = layoutDay(byDay.get(key) ?? []);
    return (
      <div
        key={key}
        className="relative border-l"
        style={{ height: hours.length * HOUR_PX }}
      >
        {hours.map((h) => (
          <div
            key={h}
            className="border-b border-dashed border-border/60"
            style={{ height: HOUR_PX }}
          />
        ))}
        {positioned.map(({ apt, top, height, left, width }) => (
          <AppointmentItem
            key={apt.id}
            appointment={apt}
            variant="block"
            canEdit={canEdit}
            canDelete={canDelete}
            style={{ top, height, left, width }}
          />
        ))}
      </div>
    );
  };

  const hasOverdue = missedApts.length > 0 || overdueTasks.length > 0;

  return (
    <>
      <PageHeader
        title="Kalender"
        description={
          teamView
            ? "Team-Kalender: Termine und Aufgaben aller aktiven Mitarbeiter."
            : "Deine Termine und fälligen Aufgaben im Blick."
        }
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="bg-card"
              title="Privaten iCal-Link unter Mein Konto erzeugen"
            >
              <Link href="/konto">
                <CalendarPlus className="size-4" />
                Kalender abonnieren (iCal)
              </Link>
            </Button>
            <AppointmentCreateDialog
              employees={teamEmployees.map((e) => ({
                id: e.id,
                name: e.name,
              }))}
              currentEmployeeId={employee.id}
              initialOpen={initialOpen}
            />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-8 bg-card"
              >
                <Link href={href(view, prevDate)} aria-label="Zurück">
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="bg-card">
                <Link href={href(view, new Date())}>Heute</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-8 bg-card"
              >
                <Link href={href(view, nextDate)} aria-label="Weiter">
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <h2 className="ml-3 font-display text-base font-semibold capitalize">
                {title}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
              {(
                [
                  ["monat", "Monat"],
                  ["woche", "Woche"],
                  ["tag", "Tag"],
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  href={href(v, date)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    view === v
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Link>
              ))}
              {isSuperadmin && (
                <>
                  <div className="mx-0.5 h-4 w-px bg-border" />
                  <Link
                    href={href(view, date, {
                      team: !teamView,
                      mitarbeiter: null,
                    })}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
                      teamView
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Users className="size-3.5" />
                    Team
                  </Link>
                </>
              )}
            </div>
          </div>

          {teamView && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2.5 py-2">
              <Link
                href={href(view, date, { mitarbeiter: null })}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  !filterId
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                Alle
              </Link>
              {teamEmployees.map((e) => (
                <Link
                  key={e.id}
                  href={href(view, date, {
                    mitarbeiter: filterId === e.id ? null : e.id,
                  })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs font-medium transition-colors",
                    filterId === e.id
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <EmployeeAvatar name={e.name} color={e.color} size="sm" />
                  {e.name}
                </Link>
              ))}
              <div className="ml-auto">
                <FilterSelect
                  param="mitarbeiter"
                  placeholder="Alle Mitarbeiter"
                  options={teamEmployees.map((e) => ({
                    value: e.id,
                    label: e.name,
                  }))}
                />
              </div>
            </div>
          )}

          {view === "monat" && (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayApts = byDay.get(key) ?? [];
                  const dayTasks = tasksByDay.get(key) ?? [];
                  const inMonth = isSameMonth(day, date);
                  const items: { key: string; node: React.ReactNode }[] = [
                    ...dayTasks.map((t) => ({
                      key: `t-${t.id}`,
                      node: (
                        <TaskItem
                          task={t}
                          variant="chip"
                          canComplete={canCompleteTasks}
                        />
                      ),
                    })),
                    ...dayApts.map((apt) => ({
                      key: `a-${apt.id}`,
                      node: (
                        <AppointmentItem
                          appointment={apt}
                          variant="chip"
                          canEdit={canEdit}
                          canDelete={canDelete}
                        />
                      ),
                    })),
                  ];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-27 border-t border-r p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-child(-n+7)]:border-t-0",
                        !inMonth && "bg-muted/30",
                      )}
                    >
                      <div className="mb-1 flex justify-between">
                        <Link
                          href={href("tag", day)}
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular hover:bg-accent",
                            isToday(day) &&
                              "bg-primary text-primary-foreground ring-2 ring-primary/25 hover:bg-primary",
                            !inMonth && "text-muted-foreground/60",
                          )}
                        >
                          {format(day, "d")}
                        </Link>
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((item) => (
                          <div key={item.key}>{item.node}</div>
                        ))}
                        {items.length > 3 && (
                          <Link
                            href={href("tag", day)}
                            className="block px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            +{items.length - 3} weitere
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(view === "woche" || view === "tag") && (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <div
                className={cn(
                  "grid min-w-150",
                  view === "woche"
                    ? "grid-cols-[3rem_repeat(7,1fr)]"
                    : "grid-cols-[3rem_1fr]",
                )}
              >
                <div className="border-b" />
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-b border-l py-2 text-center",
                      isToday(day) && "bg-primary/5",
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      {format(day, "EEEEEE", { locale: de })}
                    </p>
                    <p
                      className={cn(
                        "font-display text-sm font-semibold tabular",
                        isToday(day) && "text-primary",
                      )}
                    >
                      {format(day, "d. MMM", { locale: de })}
                    </p>
                  </div>
                ))}

                {taskCount > 0 && (
                  <>
                    {/* Ganztags-Zeile: Aufgaben haben nur ein Fälligkeitsdatum,
                        keinen Zeitblock — so bleiben die Zeitspalten frei. */}
                    <div className="flex items-start justify-end gap-1 border-b bg-muted/20 px-1.5 pt-1.5">
                      <ListTodo className="size-3.5 text-muted-foreground" />
                    </div>
                    {days.map((day) => {
                      const dayTasks =
                        tasksByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "space-y-0.5 border-b border-l bg-muted/20 p-1",
                            isToday(day) && "bg-primary/5",
                          )}
                        >
                          {dayTasks.map((t) => (
                            <TaskItem
                              key={t.id}
                              task={t}
                              variant="chip"
                              canComplete={canCompleteTasks}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}

                <div className="relative">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="pr-2 text-right text-[10px] text-muted-foreground tabular"
                      style={{ height: HOUR_PX }}
                    >
                      <span className="relative -top-1.5">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>
                {days.map((day) => renderDayColumn(day))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CalendarDays className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Anstehend</h3>
            </div>

            {hasOverdue && (
              <div className="border-b bg-destructive/5 px-2 py-2">
                <p className="flex items-center gap-1.5 px-2 pb-1 text-xs font-semibold text-destructive">
                  <span className="size-1.5 rounded-full bg-destructive" />
                  Überfällig
                </p>
                <ul>
                  {missedApts.map((apt) => (
                    <li key={apt.id}>
                      <AppointmentItem
                        appointment={apt}
                        variant="row"
                        canEdit={canEdit}
                        canDelete={canDelete}
                      />
                    </li>
                  ))}
                  {overdueTasks.map((t) => (
                    <li key={t.id}>
                      <TaskItem
                        task={t}
                        variant="row"
                        canComplete={canCompleteTasks}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {upcoming.length === 0 && !hasOverdue ? (
              <EmptyState
                icon={CalendarDays}
                title="Keine anstehenden Termine"
                description="Erstelle einen Termin, um deine Planung zu starten."
                className="border-0 py-10"
              />
            ) : (
              <ul className="divide-y">
                {upcoming.map((apt) => (
                  <li key={apt.id} className="px-2 py-1">
                    <AppointmentItem
                      appointment={apt}
                      variant="row"
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                    {apt.entityType && apt.entityId && (
                      <Link
                        href={entityHref(
                          apt.entityType as EntityType,
                          apt.entityId,
                        )}
                        className="mb-1.5 ml-6.5 inline-flex"
                      >
                        <Badge variant="outline" className="hover:bg-accent">
                          {ENTITY_LABELS[apt.entityType as EntityType] ??
                            apt.entityType}
                        </Badge>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
