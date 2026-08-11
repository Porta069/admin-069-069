import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppointmentCreateDialog } from "./_components/appointment-dialog";
import {
  AppointmentItem,
  type AppointmentData,
} from "./_components/appointment-item";

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

  const [rows, upcomingRows, employees] = await Promise.all([
    sql`
      select a.*, e.name as employee_name, e.avatar_color as employee_color
      from admin.appointment a
      left join admin.employee e on e.id = a.employee_id
      where a.deleted_at is null
        and a.starts_at <= ${rangeEnd} and a.ends_at >= ${rangeStart}
      order by a.starts_at asc
      limit 500`,
    sql`
      select a.*, e.name as employee_name, e.avatar_color as employee_color
      from admin.appointment a
      left join admin.employee e on e.id = a.employee_id
      where a.deleted_at is null and a.status = 'PLANNED' and a.starts_at >= now()
      order by a.starts_at asc
      limit 10`,
    sql`
      select id, name from admin.employee
      where status = 'ACTIVE' and deleted_at is null
      order by name`,
  ]);

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
  });

  const appointments = rows.map(toApt);
  const upcoming = upcomingRows.map(toApt);

  const byDay = new Map<string, AptRow[]>();
  for (const apt of appointments) {
    const key = berlinDayKey.format(apt.startDate);
    const list = byDay.get(key) ?? [];
    list.push(apt);
    byDay.set(key, list);
  }

  const canEdit = can(employee, "calendar", "edit");
  const canDelete = can(employee, "calendar", "delete");

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

  const href = (v: View, d: Date) =>
    `/kalender?ansicht=${v}&datum=${format(d, "yyyy-MM-dd")}`;

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
    const dayApts = byDay.get(key) ?? [];
    return (
      <div
        key={key}
        className="relative border-l first:border-l-0"
        style={{ height: hours.length * HOUR_PX }}
      >
        {hours.map((h) => (
          <div
            key={h}
            className="border-b border-dashed border-border/60"
            style={{ height: HOUR_PX }}
          />
        ))}
        {dayApts.map((apt) => {
          const start = Math.max(berlinHours(apt.startDate), DAY_START);
          const end = Math.min(
            Math.max(berlinHours(apt.endDate), start + 0.4),
            DAY_END,
          );
          if (start >= DAY_END) return null;
          return (
            <AppointmentItem
              key={apt.id}
              appointment={apt}
              variant="block"
              canEdit={canEdit}
              canDelete={canDelete}
              style={{
                top: (start - DAY_START) * HOUR_PX + 1,
                height: Math.max((end - start) * HOUR_PX - 2, 18),
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Termine des Teams planen und im Blick behalten."
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
              employees={employees.map((e) => ({
                id: e.id as string,
                name: e.name as string,
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
            </div>
          </div>

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
                  const inMonth = isSameMonth(day, date);
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
                        {dayApts.slice(0, 3).map((apt) => (
                          <AppointmentItem
                            key={apt.id}
                            appointment={apt}
                            variant="chip"
                            canEdit={canEdit}
                            canDelete={canDelete}
                          />
                        ))}
                        {dayApts.length > 3 && (
                          <Link
                            href={href("tag", day)}
                            className="block px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                          >
                            +{dayApts.length - 3} weitere
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
              <h3 className="text-sm font-semibold">Anstehende Termine</h3>
            </div>
            {upcoming.length === 0 ? (
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
