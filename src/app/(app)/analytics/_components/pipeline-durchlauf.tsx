import { sql } from "@/lib/db";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { EmptyState } from "@/components/common/empty-state";
import { GitBranch, Hourglass } from "lucide-react";

const PIPELINE_ORDER = [
  "NEU",
  "IN_BEARBEITUNG",
  "GEPRUEFT",
  "MATCHING",
  "VORGESCHLAGEN",
  "BEWERBUNG",
  "INTERVIEW",
  "ZUSAGE",
];

interface DwellRow {
  status: string;
  avg_days: number;
  transitions: number;
}

function formatDays(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours} Std.`;
  }
  return `${days.toFixed(1)} Tg.`;
}

/**
 * Abschnitt „Pipeline-Durchlauf (Engpass)" für /analytics. Berechnet die Ø
 * Verweildauer je Pipeline-Status aus admin.audit_log (candidate.status_changed):
 * Zeit zwischen aufeinanderfolgenden Statuswechseln desselben Kandidaten.
 * Eigenständige Server-Komponente — wird vom Koordinator in page.tsx eingebaut.
 */
export async function PipelineDurchlauf() {
  const rows = await sql<DwellRow[]>`
    with ev as (
      select entity_id,
             (metadata->>'status') as status,
             created_at,
             lead(created_at) over (
               partition by entity_id order by created_at
             ) as next_at
      from admin.audit_log
      where action = 'candidate.status_changed'
        and entity_type = 'candidate'
        and metadata->>'status' is not null
    )
    select status,
           avg(extract(epoch from (next_at - created_at)) / 86400)::float as avg_days,
           count(*)::int as transitions
    from ev
    where next_at is not null
    group by status`;

  const byStatus = new Map(rows.map((r) => [r.status, r]));
  const ordered = PIPELINE_ORDER.map((s) => ({
    status: s,
    label: CANDIDATE_STATUS[s]?.label ?? s,
    avg_days: byStatus.get(s)?.avg_days ?? 0,
    transitions: byStatus.get(s)?.transitions ?? 0,
  })).filter((r) => r.transitions > 0);

  const totalTransitions = rows.reduce((sum, r) => sum + r.transitions, 0);
  const maxAvg = Math.max(1, ...ordered.map((r) => r.avg_days));
  const bottleneck =
    ordered.length > 0
      ? ordered.reduce((a, b) => (b.avg_days > a.avg_days ? b : a))
      : null;

  return (
    <section className="mb-5 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <GitBranch className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold">
          Pipeline-Durchlauf · Ø Verweildauer je Status
        </h2>
      </div>

      {totalTransitions < 1 || ordered.length === 0 ? (
        <EmptyState
          icon={Hourglass}
          title="Datenbasis wächst mit der Nutzung"
          description="Sobald Kandidaten mehrere Pipeline-Statuswechsel durchlaufen, entsteht hier die durchschnittliche Verweildauer je Status und der Engpass wird sichtbar."
          className="border-0 py-10"
        />
      ) : (
        <div className="space-y-4 p-4">
          {bottleneck && (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              Engpass:{" "}
              <span className="font-semibold">
                {CANDIDATE_STATUS[bottleneck.status]?.label ?? bottleneck.status}
              </span>{" "}
              mit Ø{" "}
              <span className="font-semibold tabular">
                {formatDays(bottleneck.avg_days)}
              </span>{" "}
              Verweildauer.
            </p>
          )}
          <div className="space-y-2.5">
            {ordered.map((r) => (
              <div key={r.status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-sm">{r.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className={
                      "flex h-full items-center justify-end rounded-md px-2 " +
                      (bottleneck && r.status === bottleneck.status
                        ? "bg-primary"
                        : "bg-primary/50")
                    }
                    style={{
                      width: `${Math.max(6, (r.avg_days / maxAvg) * 100)}%`,
                    }}
                  >
                    <span className="text-xs font-medium tabular text-primary-foreground">
                      {formatDays(r.avg_days)}
                    </span>
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-xs tabular text-muted-foreground">
                  {r.transitions} Wechsel
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Basiert auf {totalTransitions} protokollierten Statuswechseln. Nur
            Status, die bereits wieder verlassen wurden, fließen ein.
          </p>
        </div>
      )}
    </section>
  );
}
