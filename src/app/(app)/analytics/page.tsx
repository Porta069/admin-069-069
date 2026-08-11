import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { formatEuroCents, formatNumber } from "@/lib/format";
import { REFERRAL_STATUS } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { BarChart3, LineChart as LineChartIcon, PieChart } from "lucide-react";
import {
  DailyAreaChart,
  DonutLegend,
  FunnelChart,
  FunnelLegend,
  ReferralDonut,
  type DailyPoint,
  type FunnelStep,
} from "./_components/charts";

const RANGES = [
  { key: "7d", label: "7 Tage", days: 7 },
  { key: "30d", label: "30 Tage", days: 30 },
  { key: "90d", label: "90 Tage", days: 90 },
  { key: "jahr", label: "1 Jahr", days: 365 },
] as const;

const berlinDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function buildDailySeries(
  days: number,
  counts: Map<string, number>,
): DailyPoint[] {
  const points: DailyPoint[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const key = berlinDay.format(new Date(now - i * 86_400_000));
    const [, m, d] = key.split("-");
    points.push({
      day: key,
      label: `${Number(d)}.${Number(m)}.`,
      value: counts.get(key) ?? 0,
    });
  }
  return points;
}

function toCountMap(rows: { day: string; count: number }[]): Map<string, number> {
  return new Map(rows.map((r) => [r.day, r.count]));
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("analytics");
  const params = await searchParams;
  const range =
    RANGES.find((r) => r.key === firstParam(params.zeitraum)) ?? RANGES[1];
  const interval = `${range.days} days`;

  const [
    [kpi],
    [funnel],
    regDaily,
    appDaily,
    performance,
    referralByStatus,
    [affiliate],
  ] = await Promise.all([
    sql`
      select
        (select count(*)::int from public."Application"
         where status <> 'ERASED' and "createdAt" >= now() - ${interval}::interval) as regs,
        (select count(*)::int from public."Company"
         where "createdAt" >= now() - ${interval}::interval) as companies,
        (select count(*)::int from public."JobPosting"
         where "createdAt" >= now() - ${interval}::interval) as jobs,
        (select count(*)::int from public."JobApplication"
         where "createdAt" >= now() - ${interval}::interval) as apps,
        (select count(*)::int from public."JobApplication"
         where "createdAt" >= now() - ${interval}::interval and status = 'ACCEPTED') as apps_accepted,
        (select count(*)::int from admin.placement
         where deleted_at is null and status <> 'CANCELLED'
           and placed_at >= now() - ${interval}::interval) as placements,
        (select coalesce(sum(base_fee_cents + coalesce(commission_cents, 0)), 0)::bigint
         from admin.placement
         where deleted_at is null and status <> 'CANCELLED'
           and placed_at >= now() - ${interval}::interval) as revenue,
        (select avg(extract(epoch from (p.placed_at - a."createdAt")) / 86400)::float
         from admin.placement p
         join public."Application" a on a.id = p.application_id
         where p.deleted_at is null and p.status <> 'CANCELLED'
           and p.placed_at >= now() - ${interval}::interval) as avg_days`,
    sql`
      select
        (select count(*)::int from public."Application"
         where status <> 'ERASED' and "createdAt" >= now() - ${interval}::interval) as regs,
        (select count(*)::int from public."JobApplication"
         where "createdAt" >= now() - ${interval}::interval) as apps,
        (select count(*)::int from public."JobApplication"
         where "createdAt" >= now() - ${interval}::interval
           and status in ('INTERVIEW', 'ACCEPTED')) as interviews,
        (select count(*)::int from public."JobApplication"
         where "createdAt" >= now() - ${interval}::interval and status = 'ACCEPTED') as accepted,
        (select count(*)::int from admin.placement
         where deleted_at is null and status <> 'CANCELLED'
           and placed_at >= now() - ${interval}::interval) as placements`,
    sql`
      select ((a."createdAt" at time zone 'Europe/Berlin')::date)::text as day,
             count(*)::int as count
      from public."Application" a
      where a.status <> 'ERASED' and a."createdAt" >= now() - ${interval}::interval
      group by 1`,
    sql`
      select ((j."createdAt" at time zone 'Europe/Berlin')::date)::text as day,
             count(*)::int as count
      from public."JobApplication" j
      where j."createdAt" >= now() - ${interval}::interval
      group by 1`,
    sql`
      select e.id, e.name, e.avatar_color,
        (select count(*)::int from admin.candidate_meta cm
         where cm.assignee_id = e.id and cm.archived_at is null) as candidates,
        (select count(*)::int from admin.task t
         where t.assignee_id = e.id and t.deleted_at is null
           and t.status = 'DONE' and t.completed_at >= now() - interval '30 days') as tasks_done,
        (select count(*)::int from admin.placement p
         where p.employee_id = e.id and p.deleted_at is null
           and p.status <> 'CANCELLED') as placements,
        (select count(*)::int from admin.note n
         where n.author_id = e.id and n.deleted_at is null
           and n.created_at >= now() - interval '30 days') as notes
      from admin.employee e
      where e.status = 'ACTIVE' and e.deleted_at is null
      order by e.name`,
    sql`
      select status, count(*)::int as count
      from public."Referral"
      group by status
      order by count desc`,
    sql`
      select coalesce(sum("rewardCents"), 0)::bigint as reward_cents
      from public."Referral"
      where status in ('PLACED', 'PAID')
        and coalesce("placedAt", "paidAt") >= now() - ${interval}::interval`,
  ]);

  const conversion =
    (kpi.apps as number) > 0
      ? Math.round(((kpi.apps_accepted as number) / (kpi.apps as number)) * 100)
      : null;

  const pct = (value: number, prev: number): number | null =>
    prev > 0 ? Math.round((value / prev) * 100) : null;

  const funnelSteps: FunnelStep[] = [
    { name: "Registrierungen", value: funnel.regs as number, pct: null },
    {
      name: "Bewerbungen",
      value: funnel.apps as number,
      pct: pct(funnel.apps as number, funnel.regs as number),
    },
    {
      name: "Interviews",
      value: funnel.interviews as number,
      pct: pct(funnel.interviews as number, funnel.apps as number),
    },
    {
      name: "Zusagen",
      value: funnel.accepted as number,
      pct: pct(funnel.accepted as number, funnel.interviews as number),
    },
    {
      name: "Vermittlungen",
      value: funnel.placements as number,
      pct: pct(funnel.placements as number, funnel.accepted as number),
    },
  ];
  const funnelHasData = funnelSteps.some((s) => s.value > 0);

  const regSeries = buildDailySeries(
    range.days,
    toCountMap(regDaily as unknown as { day: string; count: number }[]),
  );
  const appSeries = buildDailySeries(
    range.days,
    toCountMap(appDaily as unknown as { day: string; count: number }[]),
  );
  const regHasData = regSeries.some((p) => p.value > 0);
  const appHasData = appSeries.some((p) => p.value > 0);

  const donutData = referralByStatus.map((r) => ({
    name: REFERRAL_STATUS[r.status as string]?.label ?? (r.status as string),
    value: r.count as number,
  }));
  const donutHasData = donutData.some((d) => d.value > 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Kennzahlen und Trends über die gesamte Vermittlungs-Pipeline."
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/analytics?zeitraum=${r.key}`}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  range.key === r.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPI-Zeile */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Registrierungen" value={formatNumber(kpi.regs as number)} />
        <KpiCard label="Neue Unternehmen" value={formatNumber(kpi.companies as number)} />
        <KpiCard label="Neue Jobs" value={formatNumber(kpi.jobs as number)} />
        <KpiCard label="Bewerbungen" value={formatNumber(kpi.apps as number)} />
        <KpiCard
          label="Vermittlungen"
          value={formatNumber(kpi.placements as number)}
          accent
        />
        <KpiCard
          label="Umsatz"
          value={formatEuroCents(Number(kpi.revenue))}
          hint={`im Zeitraum (${range.label})`}
        />
        <KpiCard
          label="Conversion Bewerbung → Zusage"
          value={conversion === null ? "—" : `${conversion} %`}
        />
        <KpiCard
          label="Ø Tage Registrierung → Vermittlung"
          value={
            kpi.avg_days === null || kpi.avg_days === undefined
              ? "—"
              : formatNumber(Math.round(kpi.avg_days as number))
          }
        />
      </div>

      {/* Funnel */}
      <section className="mb-5 rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">
          Funnel · Registrierung bis Vermittlung
        </h2>
        {funnelHasData ? (
          <>
            <FunnelChart steps={funnelSteps} />
            <div className="mt-2 border-t pt-3">
              <FunnelLegend steps={funnelSteps} />
            </div>
          </>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Noch keine Daten im Zeitraum"
            description="Sobald Registrierungen und Bewerbungen eingehen, entsteht hier der Funnel."
            className="border-0 py-10"
          />
        )}
      </section>

      {/* Zeitreihen */}
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">
            Registrierungen pro Tag
          </h2>
          {regHasData ? (
            <DailyAreaChart
              data={regSeries}
              color="var(--chart-1)"
              name="Registrierungen"
            />
          ) : (
            <EmptyState
              icon={LineChartIcon}
              title="Keine Registrierungen im Zeitraum"
              className="border-0 py-10"
            />
          )}
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold">
            Bewerbungen pro Tag
          </h2>
          {appHasData ? (
            <DailyAreaChart
              data={appSeries}
              color="var(--chart-2)"
              name="Bewerbungen"
            />
          ) : (
            <EmptyState
              icon={LineChartIcon}
              title="Keine Bewerbungen im Zeitraum"
              className="border-0 py-10"
            />
          )}
        </section>
      </div>

      {/* Mitarbeiter-Performance */}
      <section className="mb-5 overflow-x-auto rounded-lg border bg-card">
        <h2 className="border-b px-4 py-3 font-display text-sm font-semibold">
          Mitarbeiter-Performance
        </h2>
        {performance.length === 0 ? (
          <EmptyState
            title="Keine aktiven Mitarbeiter"
            className="border-0 py-10"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Mitarbeiter</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Zugewiesene Kandidaten
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Erledigte Aufgaben (30 T.)
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Vermittlungen
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Notizen (30 T.)
                </th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr key={p.id as string} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <EmployeeAvatar
                        name={p.name as string}
                        color={p.avatar_color as string}
                        size="sm"
                      />
                      <span className="font-medium">{p.name as string}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {formatNumber(p.candidates as number)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {formatNumber(p.tasks_done as number)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {formatNumber(p.placements as number)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {formatNumber(p.notes as number)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Affiliate */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">Affiliate</h2>
        {donutHasData ? (
          <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr_auto]">
            <ReferralDonut data={donutData} />
            <DonutLegend data={donutData} />
            <div className="rounded-lg border bg-muted/40 p-4 text-center sm:min-w-44">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Prämien-Kosten ({range.label})
              </p>
              <p className="mt-1.5 font-display text-2xl font-semibold tabular">
                {formatEuroCents(Number(affiliate.reward_cents))}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={PieChart}
            title="Noch keine Referrals"
            description="Sobald Partner Kandidaten werben, erscheinen hier Status und Prämien-Kosten."
            className="border-0 py-10"
          />
        )}
      </section>
    </>
  );
}
