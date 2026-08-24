import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatRelative, formatDateTime } from "@/lib/format";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Button } from "@/components/ui/button";
import { PhoneCall, CheckCircle2, Clock, PhoneOff } from "lucide-react";

export const metadata = { title: "Call Center" };

interface QueueRow {
  task_id: string;
  due_at: Date | null;
  priority: string | null;
  candidate_id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  profession: string | null;
  pipeline_status: string | null;
  assignee_name: string | null;
  assignee_color: string | null;
  overdue: boolean;
}

export default async function CallCenterPage() {
  await requireEmployee("candidates");

  const [queue, kpi, recent] = await Promise.all([
    sql<QueueRow[]>`
      select t.id as task_id, t.due_at, t.priority,
             c.id as candidate_id, c."firstName", c."lastName", c.phone, c.email,
             c.profession, cm.status as pipeline_status,
             e.name as assignee_name, e.avatar_color as assignee_color,
             (t.due_at < now()) as overdue
      from admin.task t
      join admin.candidate c on c.id = t.entity_id
      left join admin.candidate_meta cm on cm.application_id = c.id
      left join admin.employee e on e.id = t.assignee_id and e.deleted_at is null
      where t.entity_type = 'candidate' and t.status = 'OPEN'
        and (t.title like 'Neuregistrierung anrufen:%' or t.title like 'Rückruf:%') and t.deleted_at is null
      order by
        (t.due_at < now()) desc,
        case t.priority
          when 'DRINGEND' then 0 when 'HOCH' then 1 when 'NORMAL' then 2 else 3 end asc,
        (t.title like 'Rückruf:%') desc,
        t.due_at asc nulls last,
        t.created_at asc`,
    sql<{ offen: number; ueberfaellig: number; heute: number; woche: number }[]>`
      select
        (select count(*)::int from admin.task
           where entity_type='candidate' and status='OPEN'
             and (title like 'Neuregistrierung anrufen:%' or title like 'Rückruf:%') and deleted_at is null) as offen,
        (select count(*)::int from admin.task
           where entity_type='candidate' and status='OPEN'
             and (title like 'Neuregistrierung anrufen:%' or title like 'Rückruf:%') and deleted_at is null
             and due_at < now()) as ueberfaellig,
        (select count(*)::int from admin.call_session
           where status='ABGESCHLOSSEN' and (completed_at at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date) as heute,
        (select count(*)::int from admin.candidate
           where "createdAt" >= now() - interval '7 days') as woche`,
    sql<
      {
        id: string;
        candidate_name: string;
        application_id: string;
        top_jobs: unknown;
        completed_at: Date | null;
        employee_name: string | null;
      }[]
    >`
      select cs.id, cs.candidate_name, cs.application_id, cs.top_jobs,
             cs.completed_at, e.name as employee_name
      from admin.call_session cs
      left join admin.employee e on e.id = cs.employee_id
      where cs.status = 'ABGESCHLOSSEN' and cs.deleted_at is null
      order by cs.completed_at desc nulls last
      limit 8`,
  ]);
  const k = kpi[0];

  return (
    <>
      <PageHeader
        title="Call Center"
        description="Priorisierte Anruf-Warteschlange (überfällig & dringend zuerst) — 3 KI-Fragen stellen und den Top-1-Job-Match finden."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Offene Anrufe" value={k.offen} accent />
        <KpiCard
          label="Überfällig"
          value={k.ueberfaellig}
          hint={k.ueberfaellig > 0 ? "brauchen Aufmerksamkeit" : "alles im Plan"}
        />
        <KpiCard label="Heute erledigt" value={k.heute} />
        <KpiCard label="Registriert (7 Tage)" value={k.woche} />
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={PhoneOff}
          title="Keine offenen Anrufe"
          description="Aktuell steht niemand zum Anrufen an. Nach jeder neuen Registrierung erscheint hier automatisch ein Eintrag."
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Warteschlange · {queue.length}
            </h2>
          </div>
          {queue.map((r, i) => (
            <div
              key={r.task_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">
                    {r.firstName} {r.lastName}
                  </p>
                  <StatusBadge
                    map={CANDIDATE_STATUS}
                    value={r.pipeline_status ?? "NEU"}
                  />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.profession, r.phone, r.email].filter(Boolean).join(" · ")}
                </p>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <PriorityBadge value={r.priority} />
                {r.due_at && (
                  <span
                    className={
                      r.overdue
                        ? "inline-flex items-center gap-1 text-xs font-medium text-destructive"
                        : "inline-flex items-center gap-1 text-xs text-muted-foreground"
                    }
                  >
                    <Clock className="size-3" />
                    {r.overdue ? "überfällig · " : "fällig "}
                    {formatRelative(r.due_at)}
                  </span>
                )}
              </div>

              {r.assignee_name ? (
                <span className="hidden items-center gap-1.5 md:flex">
                  <EmployeeAvatar
                    name={r.assignee_name}
                    color={r.assignee_color ?? undefined}
                    size="sm"
                  />
                </span>
              ) : null}

              {r.phone && (
                <a
                  href={`tel:${r.phone}`}
                  className="hidden text-xs text-muted-foreground hover:text-foreground lg:inline"
                  title={`${r.phone} wählen`}
                >
                  {r.phone}
                </a>
              )}

              <Button asChild size="sm">
                <Link href={`/callcenter/${r.candidate_id}?task=${r.task_id}`}>
                  <PhoneCall className="size-3.5" />
                  Anruf starten
                </Link>
              </Button>
            </div>
          ))}
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mr-1 inline size-3 align-[-1px]" />
            Erledigte Anrufe verschwinden automatisch aus der Warteschlange.
          </p>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-8 space-y-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            Zuletzt erledigt
          </h2>
          {recent.map((r) => {
            const jobs = Array.isArray(r.top_jobs)
              ? (r.top_jobs as { title?: string; score?: number }[])
              : [];
            const top = jobs[0];
            return (
              <Link
                key={r.id}
                href={`/kandidaten/${r.application_id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card p-3 text-sm transition-shadow hover:shadow-sm"
              >
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="font-medium">{r.candidate_name}</span>
                {top?.title && (
                  <span className="text-muted-foreground">
                    → Top-Match: {top.title}
                    {typeof top.score === "number"
                      ? ` (${Math.round(top.score)}%)`
                      : ""}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {r.employee_name ?? "—"}
                  {r.completed_at ? ` · ${formatDateTime(r.completed_at)}` : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
