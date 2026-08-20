import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { formatEuroCents, formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { FilterSelect } from "@/components/data-table/filter-select";
import { adsKennzahlen } from "@/lib/ads/analytics";
import { AdsChart } from "../_components/ads-chart";
import { SyncButton } from "../_components/sync-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Werbe-Analytics" };

const RANGES: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

export default async function AdsAnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireEmployee("communication");
  const params = await searchParams;
  const rangeKey = RANGES[firstParam(params.range) ?? "30"] ? (firstParam(params.range) ?? "30") : "30";
  const tage = RANGES[rangeKey];
  const platform = firstParam(params.platform) ?? null;
  const campaignId = firstParam(params.campaign) ?? null;

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (tage - 1));

  const [{ totals, serie, hatDaten }, kampagnen] = await Promise.all([
    adsKennzahlen({ since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), platform, campaignId }),
    sql`select id, name from admin.ads_campaign where deleted_at is null order by created_at desc limit 200`,
  ]);

  return (
    <div>
      <PageHeader
        title="Werbe-Analytics"
        description="Ausgaben, Reichweite und Conversions je Tag, Plattform und Kampagne."
        actions={<SyncButton />}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterSelect param="range" placeholder="Zeitraum" options={[
          { value: "7", label: "7 Tage" }, { value: "30", label: "30 Tage" }, { value: "90", label: "90 Tage" },
        ]} className="h-9 w-32 bg-card" />
        <FilterSelect param="platform" placeholder="Alle Plattformen" options={[
          { value: "meta_instagram", label: "Instagram" }, { value: "meta_facebook", label: "Facebook" }, { value: "snapchat", label: "Snapchat" },
        ]} />
        <FilterSelect param="campaign" placeholder="Alle Kampagnen"
          options={kampagnen.map((k) => ({ value: k.id as string, label: k.name as string }))} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard accent label="Ausgaben" value={formatEuroCents(totals.spendCents)} />
        <KpiCard label="Impressionen" value={formatNumber(totals.impressions)} />
        <KpiCard label="Klicks" value={formatNumber(totals.clicks)} hint={`CTR ${totals.ctr.toFixed(2)} %`} />
        <KpiCard label="Registrierungen" value={formatNumber(totals.registrations)} hint={totals.cpaCents != null ? `CPA ${formatEuroCents(totals.cpaCents)}` : undefined} />
      </div>

      <div className="mb-6"><AdsChart serie={serie} /></div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Tageswerte</h2>
        </div>
        {hatDaten ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Datum</th>
                  <th className="px-4 py-2 font-medium">Ausgaben</th>
                  <th className="px-4 py-2 font-medium">Impressionen</th>
                  <th className="px-4 py-2 font-medium">Klicks</th>
                  <th className="px-4 py-2 font-medium">Registr.</th>
                  <th className="px-4 py-2 font-medium">CPA</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((p) => (
                  <tr key={p.datum} className="border-b last:border-0">
                    <td className="px-4 py-2">{formatDate(p.datum)}</td>
                    <td className="px-4 py-2">{formatEuroCents(p.spendCents)}</td>
                    <td className="px-4 py-2">{formatNumber(p.impressions)}</td>
                    <td className="px-4 py-2">{formatNumber(p.clicks)}</td>
                    <td className="px-4 py-2">{formatNumber(p.registrations)}</td>
                    <td className="px-4 py-2">{p.cpaCents != null ? formatEuroCents(p.cpaCents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Noch keine synchronisierten Daten. Nach dem Verbinden einer Plattform erscheinen hier echte Tageswerte.
          </p>
        )}
      </div>
    </div>
  );
}
