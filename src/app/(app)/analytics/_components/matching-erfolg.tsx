import { sql } from "@/lib/db";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { GitBranch, Target } from "lucide-react";

const FLOW = ["NEU", "ANGERUFEN", "MATCHING", "ABWICKLUNG", "BEWERBUNG", "ANGENOMMEN"];

/**
 * #8 Status-Verteilung (wo stehen die Kandidaten gerade) + #7 Match-Score →
 * Erfolg (konvertieren hohe Score-Werte wirklich in Vermittlungen?). Beides
 * read-only aus vorhandenen Daten — die Feedback-Schleife des Matchings.
 */
export async function MatchingErfolg() {
  const [statusRows, scoreRows] = await Promise.all([
    sql`
      select cm.status, count(*)::int as n
      from admin.candidate_meta cm
      join admin.candidate a on a.id = cm.application_id
      where a.status <> 'ERASED'
      group by cm.status`,
    sql`
      select
        case
          when match_score < 20 then '0–19'
          when match_score < 40 then '20–39'
          when match_score < 60 then '40–59'
          when match_score < 80 then '60–79'
          else '80–100'
        end as bucket,
        min(match_score) as sortkey,
        count(*)::int as gesamt,
        count(*) filter (where status = 'VERMITTELT')::int as vermittelt
      from admin.proposal
      where deleted_at is null and match_score is not null
      group by 1
      order by sortkey`,
  ]);

  const statusMap = new Map<string, number>();
  for (const r of statusRows) statusMap.set(r.status as string, r.n as number);
  const flowMax = Math.max(1, ...FLOW.map((s) => statusMap.get(s) ?? 0));

  const buckets = scoreRows.map((r) => ({
    label: r.bucket as string,
    gesamt: r.gesamt as number,
    vermittelt: r.vermittelt as number,
    quote: (r.gesamt as number) > 0 ? Math.round(((r.vermittelt as number) / (r.gesamt as number)) * 100) : 0,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Status-Verteilung */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <GitBranch className="size-4 text-muted-foreground" /> Kandidaten im Ablauf
        </h2>
        <div className="space-y-2">
          {FLOW.map((s) => {
            const n = statusMap.get(s) ?? 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">
                  {CANDIDATE_STATUS[s]?.label ?? s}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/70"
                    style={{ width: `${Math.round((n / flowMax) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular">{n}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Aktuelle Verteilung der zugeordneten Kandidaten über die Ablauf-Stufen.
        </p>
      </section>

      {/* Match-Score → Erfolg */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
          <Target className="size-4 text-muted-foreground" /> Match-Score → Vermittlung
        </h2>
        {buckets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Noch keine Vorschläge mit Match-Score.
          </p>
        ) : (
          <div className="space-y-2">
            {buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground tabular">{b.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded bg-success/70" style={{ width: `${b.quote}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs tabular text-muted-foreground">
                  {b.quote}% · {b.vermittelt}/{b.gesamt}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Vermittlungsquote je Score-Bereich. Steigt sie mit dem Score, ist die Engine treffsicher —
          sinkt sie, lohnt sich ein Blick auf die Gewichte.
        </p>
      </section>
    </div>
  );
}
