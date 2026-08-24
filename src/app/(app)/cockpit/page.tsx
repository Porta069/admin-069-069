import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/format";
import { entityHref, ENTITY_LABELS, CANDIDATE_STATUS, type EntityType } from "@/lib/definitions";
import { TERMINALE_KANDIDAT_STATUS } from "@/lib/candidate-status";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmptyState } from "@/components/common/empty-state";
import { CalendarClock, ListTodo, Phone, Handshake, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mein Cockpit" };

export default async function CockpitPage() {
  const employee = await requireEmployee();

  const [aufgaben, statusRows, anrufen] = await Promise.all([
    sql`
      select t.id, t.title, t.due_at, t.priority, t.entity_type, t.entity_id
      from admin.task t
      where t.assignee_id = ${employee.id} and t.status = 'OPEN' and t.deleted_at is null
      order by (t.due_at is null), t.due_at asc
      limit 50`,
    sql`
      select cm.status, count(*)::int as n
      from admin.candidate_meta cm
      join admin.candidate a on a.id = cm.application_id
      where cm.assignee_id = ${employee.id} and a.status <> 'ERASED'
      group by cm.status`,
    sql`
      select a.id, a."firstName", a."lastName", a.profession, a.phone
      from admin.candidate a
      join admin.candidate_meta cm on cm.application_id = a.id
      where cm.assignee_id = ${employee.id} and a.status <> 'ERASED' and cm.status = 'NEU'
      order by a."createdAt" desc
      limit 20`,
  ]);

  const jetzt = Date.now();
  const ueberfaellig = aufgaben.filter(
    (t) => t.due_at && new Date(t.due_at as Date).getTime() < jetzt,
  );
  const restAufgaben = aufgaben.filter((t) => !ueberfaellig.includes(t));

  const statusMap = new Map<string, number>();
  for (const r of statusRows) statusMap.set(r.status as string, r.n as number);
  const aktivGesamt = [...statusMap.entries()]
    .filter(([s]) => !TERMINALE_KANDIDAT_STATUS.includes(s))
    .reduce((sum, [, n]) => sum + n, 0);
  const inVermittlung = statusMap.get("ABWICKLUNG") ?? 0;

  return (
    <>
      <PageHeader
        title={`Guten Tag, ${employee.name.split(" ")[0]}`}
        description="Dein Tagesüberblick — Aufgaben, Anrufe und deine aktiven Fälle auf einen Blick."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard accent label="Meine aktiven Kandidaten" value={formatNumber(aktivGesamt)} />
        <KpiCard
          label="Überfällige Aufgaben"
          value={formatNumber(ueberfaellig.length)}
          hint={ueberfaellig.length > 0 ? "brauchen Aufmerksamkeit" : "alles im Plan"}
        />
        <KpiCard label="Offene Aufgaben" value={formatNumber(aufgaben.length)} />
        <KpiCard label="In Vermittlung" value={formatNumber(inVermittlung)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Aufgaben */}
        <section className="lg:col-span-2 rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ListTodo className="size-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold">Meine Aufgaben</h2>
            <Link href="/aufgaben" className="ml-auto text-xs text-primary hover:underline">
              Alle
            </Link>
          </div>
          {aufgaben.length === 0 ? (
            <EmptyState title="Keine offenen Aufgaben" description="Du bist auf dem neuesten Stand." className="border-0 py-10" />
          ) : (
            <ul className="divide-y">
              {ueberfaellig.length > 0 && (
                <li className="bg-destructive/5 px-4 py-1.5 text-xs font-semibold text-destructive">
                  Überfällig ({ueberfaellig.length})
                </li>
              )}
              {[...ueberfaellig, ...restAufgaben].map((t) => {
                const href =
                  t.entity_type && t.entity_id && (t.entity_type as string) in ENTITY_LABELS
                    ? entityHref(t.entity_type as EntityType, t.entity_id as string)
                    : "/aufgaben";
                const overdue = ueberfaellig.includes(t);
                return (
                  <li key={t.id as string}>
                    <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title as string}</span>
                      <PriorityBadge value={t.priority as string | null} />
                      <span className={cn("shrink-0 text-xs tabular", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {t.due_at ? formatDate(t.due_at as Date) : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Anrufen + Pipeline */}
        <div className="space-y-5">
          <section className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Phone className="size-4 text-muted-foreground" />
              <h2 className="font-display text-sm font-semibold">Zu erstanrufen</h2>
              <span className="ml-auto rounded-full bg-muted px-2 text-xs tabular text-muted-foreground">
                {anrufen.length}
              </span>
            </div>
            {anrufen.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Keine neuen Kandidaten.</p>
            ) : (
              <ul className="divide-y">
                {anrufen.map((a) => (
                  <li key={a.id as string}>
                    <Link href={`/kandidaten/${a.id}/anruf`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {`${(a.firstName as string) ?? ""} ${(a.lastName as string) ?? ""}`.trim() || "Kandidat"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {(a.profession as string | null) ?? (a.phone as string | null) ?? "—"}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Handshake className="size-4 text-muted-foreground" />
              <h2 className="font-display text-sm font-semibold">Meine Pipeline</h2>
            </div>
            <div className="space-y-1.5 p-3">
              {Object.keys(CANDIDATE_STATUS)
                .filter((s) => (statusMap.get(s) ?? 0) > 0)
                .map((s) => (
                  <Link
                    key={s}
                    href={`/kandidaten?status=${s}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <StatusBadge map={CANDIDATE_STATUS} value={s} />
                    <span className="ml-auto text-sm tabular text-muted-foreground">
                      {statusMap.get(s)}
                    </span>
                  </Link>
                ))}
              {statusRows.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Dir sind noch keine Kandidaten zugeordnet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" />
        Zuständigkeiten & Verteilung: <Link href="/mitarbeiter/verteilung" className="text-primary hover:underline">Zuständigkeitsverteilung</Link>
      </p>
    </>
  );
}
