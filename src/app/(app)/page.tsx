import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import {
  formatDateTime,
  formatEuroCents,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import {
  CANDIDATE_STATUS,
  COMPANY_STATUS,
  ENTITY_LABELS,
  type EntityType,
} from "@/lib/definitions";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import {
  Building2,
  CalendarDays,
  Lock,
  ListTodo,
  UserSquare2,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  RegistrationsChart,
  type RegistrationPoint,
} from "./_dashboard/registrations-chart";
import { SectionCard, CardEmptyHint } from "./_dashboard/section-card";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  candidates: "Kandidaten",
  companies: "Unternehmen",
  jobs: "Stellenanzeigen",
  applications: "Bewerbungen",
  matching: "Matching-Center",
  placements: "Vermittlungen",
  tasks: "Aufgaben",
  calendar: "Termine",
  communication: "Kommunikation",
  notes: "Notizen",
  documents: "Dokumente",
  map: "Kartenansicht",
  analytics: "Analytics",
  automations: "Automatisierungen",
  templates: "Vorlagen",
  notifications: "Benachrichtigungen",
  employees: "Mitarbeiter",
  roles: "Rollen & Rechte",
  affiliates: "Affiliate / Partner",
  rewards: "Prämien",
  audit: "Audit & Sicherheit",
  settings: "Einstellungen",
};

const berlinHourFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "numeric",
  hour12: false,
  timeZone: "Europe/Berlin",
});
const berlinDateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});
const berlinDayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
});
const berlinDayLabelFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

function greetingFor(date: Date): string {
  const hour = Number(berlinHourFmt.format(date));
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee();
  const params = await searchParams;
  const missingModule = firstParam(params.fehlt);

  const [
    [candidatesTotal],
    [candidatesNew],
    [companiesTotal],
    [activeJobs],
    [applicationsTotal],
    [applicationsWeek],
    [placementsTotal],
    [revenue],
    registrationRows,
    activityRows,
    myTasks,
    myAppointments,
    myCandidates,
    myCompanies,
  ] = await Promise.all([
    sql`select count(*)::int as count from public."Application" where status <> 'ERASED'`,
    sql`select count(*)::int as count from public."Application"
        where status <> 'ERASED' and "createdAt" >= now() - interval '7 days'`,
    sql`select count(*)::int as count from public."Company"`,
    sql`select count(*)::int as count from public."JobPosting" where status = 'ACTIVE'`,
    sql`select count(*)::int as count from public."JobApplication"`,
    sql`select count(*)::int as count from public."JobApplication"
        where "createdAt" >= date_trunc('week', now())`,
    sql`select count(*)::int as count from admin.placement where deleted_at is null`,
    sql`select coalesce(sum(base_fee_cents + coalesce(commission_cents, 0)), 0)::bigint as total
        from admin.placement where status <> 'CANCELLED' and deleted_at is null`,
    sql`select to_char("createdAt" at time zone 'Europe/Berlin', 'YYYY-MM-DD') as day,
               count(*)::int as count
        from public."Application"
        where "createdAt" >= now() - interval '30 days'
        group by 1`,
    sql`select * from (
          select al.id::text as id, al.action, al.entity_type, al.created_at,
                 e.name as actor_name
          from admin.audit_log al
          left join admin.employee e on e.id = al.actor_id
          order by al.created_at desc limit 10
        ) a
        union all
        select * from (
          select ae.id::text, ae.action, ae."entityType", ae."createdAt", null::text
          from public."AuditEvent" ae
          order by ae."createdAt" desc limit 10
        ) p
        order by created_at desc limit 10`,
    sql`select id, title, due_at, priority, status from admin.task
        where assignee_id = ${employee.id}
          and status in ('OPEN', 'IN_PROGRESS')
          and deleted_at is null
        order by due_at asc nulls last, created_at asc
        limit 6`,
    sql`select id, title, starts_at, location from admin.appointment
        where employee_id = ${employee.id}
          and status = 'PLANNED'
          and deleted_at is null
          and starts_at >= now()
        order by starts_at asc
        limit 5`,
    sql`select a.id, a."firstName", a."lastName", a.profession,
               coalesce(cm.status, 'NEU') as pipeline_status
        from admin.candidate_meta cm
        join public."Application" a on a.id = cm.application_id
        where cm.assignee_id = ${employee.id}
          and cm.archived_at is null
          and a.status <> 'ERASED'
        order by cm.updated_at desc nulls last
        limit 6`,
    sql`select c.id, c.name, c.ort, coalesce(cm.status, 'NEU') as pipeline_status
        from admin.company_meta cm
        join public."Company" c on c.id = cm.company_id
        where cm.assignee_id = ${employee.id}
          and cm.archived_at is null
        order by c."createdAt" desc
        limit 6`,
  ]);

  const now = new Date();
  const firstName = employee.name.split(/\s+/)[0] ?? employee.name;

  // 30 Tage lückenlos auffüllen (Berliner Kalendertage).
  const countsByDay = new Map(
    registrationRows.map((r) => [r.day as string, r.count as number]),
  );
  const chartData: RegistrationPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86_400_000);
    return {
      label: berlinDayLabelFmt.format(d),
      count: countsByDay.get(berlinDayKeyFmt.format(d)) ?? 0,
    };
  });

  const kpis: {
    label: string;
    value: string;
    hint?: string;
    module: Parameters<typeof can>[1];
    href: string;
    accent?: boolean;
  }[] = [
    {
      label: "Kandidaten",
      value: formatNumber(candidatesTotal.count as number),
      hint: "gesamt",
      module: "candidates",
      href: "/kandidaten",
    },
    {
      label: "Neue Kandidaten",
      value: formatNumber(candidatesNew.count as number),
      hint: "letzte 7 Tage",
      module: "candidates",
      href: "/kandidaten",
    },
    {
      label: "Unternehmen",
      value: formatNumber(companiesTotal.count as number),
      hint: "gesamt",
      module: "companies",
      href: "/unternehmen",
    },
    {
      label: "Aktive Jobs",
      value: formatNumber(activeJobs.count as number),
      hint: "Status Aktiv",
      module: "jobs",
      href: "/stellen",
    },
    {
      label: "Bewerbungen",
      value: formatNumber(applicationsTotal.count as number),
      hint: "gesamt",
      module: "applications",
      href: "/bewerbungen",
    },
    {
      label: "Bewerb. diese Woche",
      value: formatNumber(applicationsWeek.count as number),
      hint: "seit Montag",
      module: "applications",
      href: "/bewerbungen",
    },
    {
      label: "Vermittlungen",
      value: formatNumber(placementsTotal.count as number),
      hint: "gesamt",
      module: "placements",
      href: "/vermittlungen",
    },
    {
      label: "Umsatz",
      value: formatEuroCents(Number(revenue.total)),
      hint: "gesamt, o. Storno",
      module: "placements",
      href: "/vermittlungen",
      accent: true,
    },
  ];

  return (
    <>
      {missingModule && (
        <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          <Lock className="size-4 shrink-0" />
          <span>
            Für den Bereich{" "}
            <strong className="font-semibold">
              {MODULE_LABELS[missingModule] ?? missingModule}
            </strong>{" "}
            fehlt dir die Berechtigung.
          </span>
        </div>
      )}

      <div className="pb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {greetingFor(now)}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {berlinDateFmt.format(now)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            accent={kpi.accent}
            href={can(employee, kpi.module) ? kpi.href : undefined}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Registrierungen der letzten 30 Tage" icon={TrendingUp}>
          <div className="px-2 pt-2">
            <RegistrationsChart data={chartData} />
          </div>
        </SectionCard>

        <SectionCard title="Letzte Aktivität" icon={Activity}>
          {activityRows.length === 0 ? (
            <CardEmptyHint text="Noch keine Aktivität aufgezeichnet." />
          ) : (
            <ul>
              {activityRows.map((row) => (
                <li
                  key={`${row.id}-${row.action}`}
                  className="flex items-baseline gap-2.5 rounded-md px-2 py-1.75"
                >
                  <span
                    className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-primary/60"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <code className="font-mono text-[13px]">
                        {row.action as string}
                      </code>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ENTITY_LABELS[row.entity_type as EntityType] ??
                          (row.entity_type as string)}
                        {" · "}
                        {(row.actor_name as string | null) ?? "Plattform"}
                      </span>
                    </p>
                  </div>
                  <time className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular">
                    {formatRelative(row.created_at as string)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <h2 className="mt-7 mb-3 font-display text-base font-semibold tracking-tight">
        Mein Bereich
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Meine Aufgaben"
          icon={ListTodo}
          href="/aufgaben"
          count={myTasks.length}
        >
          {myTasks.length === 0 ? (
            <CardEmptyHint text="Keine offenen Aufgaben — gut gemacht." />
          ) : (
            <ul>
              {myTasks.map((task) => {
                const overdue =
                  task.due_at && new Date(task.due_at as string) < now;
                return (
                  <li
                    key={task.id as string}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href="/aufgaben"
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {task.title as string}
                      </Link>
                      <p
                        className={
                          overdue
                            ? "text-xs font-medium text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {task.due_at
                          ? `${overdue ? "Überfällig seit " : "Fällig "}${formatDateTime(task.due_at as string)}`
                          : "Ohne Frist"}
                      </p>
                    </div>
                    <PriorityBadge value={task.priority as string} />
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Meine Termine"
          icon={CalendarDays}
          href="/kalender"
          count={myAppointments.length}
        >
          {myAppointments.length === 0 ? (
            <CardEmptyHint text="Keine anstehenden Termine." />
          ) : (
            <ul>
              {myAppointments.map((appt) => (
                <li
                  key={appt.id as string}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {appt.title as string}
                    </p>
                    {appt.location && (
                      <p className="truncate text-xs text-muted-foreground">
                        {appt.location as string}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular">
                    {formatDateTime(appt.starts_at as string)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Meine Kandidaten"
          icon={UserSquare2}
          href="/kandidaten"
          count={myCandidates.length}
        >
          {myCandidates.length === 0 ? (
            <CardEmptyHint text="Dir sind aktuell keine Kandidaten zugewiesen." />
          ) : (
            <ul>
              {myCandidates.map((c) => (
                <li
                  key={c.id as string}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/kandidaten/${c.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.firstName as string} {c.lastName as string}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {(c.profession as string | null) ?? "Ohne Berufsangabe"}
                    </p>
                  </div>
                  <StatusBadge
                    map={CANDIDATE_STATUS}
                    value={c.pipeline_status as string}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Meine Unternehmen"
          icon={Building2}
          href="/unternehmen"
          count={myCompanies.length}
        >
          {myCompanies.length === 0 ? (
            <CardEmptyHint text="Dir sind aktuell keine Unternehmen zugewiesen." />
          ) : (
            <ul>
              {myCompanies.map((c) => (
                <li
                  key={c.id as string}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/unternehmen/${c.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.name as string}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {(c.ort as string | null) ?? "—"}
                    </p>
                  </div>
                  <StatusBadge
                    map={COMPANY_STATUS}
                    value={c.pipeline_status as string}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
