import Link from "next/link";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { BadgeEuro, Building2, CalendarClock } from "lucide-react";
import { RETENTION_CENTS, RETENTION_DAYS, RETENTION_WEEKS } from "@/lib/rewards";
import { MarkRetentionPaidButton } from "./mark-retention-paid-button";

const TAG_MS = 24 * 60 * 60 * 1000;

/** Resttage bis zur Fälligkeit (negativ = überfällig). */
function restTage(due: Date): number {
  return Math.round((due.getTime() - Date.now()) / TAG_MS);
}

function dringlichkeit(rest: number) {
  if (rest <= 0)
    return { label: rest === 0 ? "heute fällig" : `fällig seit ${Math.abs(rest)} T.`, tone: "danger" as const };
  if (rest <= 14) return { label: `noch ${rest} Tage`, tone: "warning" as const };
  return { label: `noch ${rest} Tage`, tone: "ok" as const };
}

const TONE = {
  danger: { text: "text-destructive", bar: "bg-destructive", soft: "bg-destructive/10", ring: "border-destructive/40" },
  warning: { text: "text-warning", bar: "bg-warning", soft: "bg-warning-soft", ring: "border-warning/40" },
  ok: { text: "text-success", bar: "bg-success", soft: "bg-success-soft", ring: "border-transparent" },
};

export async function RetentionSection({ canEdit }: { canEdit: boolean }) {
  const rows = await sql`
    select id, application_id, candidate_name, company_name, job_title,
           placed_at, retention_due_at
    from admin.placement
    where deleted_at is null and status <> 'CANCELLED'
      and retention_paid_at is null and retention_due_at is not null
    order by retention_due_at asc
    limit 200`;

  const items = rows.map((r) => {
    const due = new Date(r.retention_due_at as string);
    const placed = new Date(r.placed_at as string);
    const rest = restTage(due);
    const elapsed = (Date.now() - placed.getTime()) / TAG_MS;
    const progress = Math.max(0, Math.min(100, Math.round((elapsed / RETENTION_DAYS) * 100)));
    return { r, due, placed, rest, progress, d: dringlichkeit(rest) };
  });

  const faellig = items.filter((i) => i.rest <= 0).length;
  const bald = items.filter((i) => i.rest > 0 && i.rest <= 14).length;
  const summe = items.length * RETENTION_CENTS;

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Jetzt fällig"
          value={faellig}
          hint={`${formatEuroCents(RETENTION_CENTS)} je Kandidat`}
          accent={faellig > 0}
          className={faellig > 0 ? "border-destructive/40" : undefined}
        />
        <KpiCard label="Bald fällig" value={bald} hint="in ≤ 14 Tagen" />
        <KpiCard label="Offen gesamt" value={items.length} hint={`${RETENTION_WEEKS}-Wochen-Frist läuft`} />
        <KpiCard label="Offenes Volumen" value={formatEuroCents(summe)} hint="noch nicht ausgezahlt" accent />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BadgeEuro}
          title="Keine offenen Treueprämien"
          description={`Sobald ein Kandidat vermittelt wird, startet die ${RETENTION_WEEKS}-Wochen-Frist bis zur ${formatEuroCents(RETENTION_CENTS)}-Belohnung — die Fälligsten erscheinen hier zuerst.`}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map(({ r, due, placed, progress, d }) => {
            const tone = TONE[d.tone];
            const appId = r.application_id as string | null;
            const name = r.candidate_name as string;
            return (
              <div
                key={r.id as string}
                className={cn("rounded-lg border bg-card p-4", tone.ring)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {appId ? (
                      <Link href={`/kandidaten/${appId}`} className="font-medium hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium">{name}</span>
                    )}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {r.company_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3" />
                          {r.company_name as string}
                        </span>
                      )}
                      {r.job_title && <span>· {r.job_title as string}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-lg font-bold tabular text-primary">
                        {formatEuroCents(RETENTION_CENTS)}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          tone.soft,
                          tone.text,
                        )}
                      >
                        <CalendarClock className="size-3" />
                        {d.label}
                      </span>
                    </div>
                    {canEdit && <MarkRetentionPaidButton placementId={r.id as string} />}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular">
                    <span>Vermittelt {formatDate(placed.toISOString())}</span>
                    <span>Fällig {formatDate(due.toISOString())}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
