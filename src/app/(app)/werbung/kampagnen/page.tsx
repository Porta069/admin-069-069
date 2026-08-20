import Link from "next/link";
import { Plus } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams, safeSort, firstParam, type SearchParams,
} from "@/lib/table-params";
import { formatEuroCents, formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/data-table/filter-select";
import {
  DataTable, type DataTableColumn, type DataTableRow,
} from "@/components/data-table/data-table";
import { CAMPAIGN_STATUS, platformLabel } from "@/lib/ads/platforms";
import { allConnections } from "@/lib/ads/connection";
import { CampaignActions } from "../_components/campaign-actions";
import { ConnectionBanner } from "../_components/connection-banner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kampagnen" };

const COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Kampagne", sortable: true },
  { key: "plattform", label: "Plattform" },
  { key: "status", label: "Status" },
  { key: "budget", label: "Tagesbudget" },
  { key: "spend", label: "Ausgaben" },
  { key: "impressions", label: "Impress.", defaultHidden: true },
  { key: "clicks", label: "Klicks", defaultHidden: true },
  { key: "ctr", label: "CTR", defaultHidden: true },
  { key: "cpc", label: "CPC", defaultHidden: true },
  { key: "regs", label: "Registr." },
  { key: "cpa", label: "CPA" },
  { key: "laufzeit", label: "Laufzeit", sortable: true },
  { key: "aktion", label: "" },
];

export default async function KampagnenPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireEmployee("communication");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, { sort: "erstellt" });
  const status = firstParam(params.status);
  const offset = (page - 1) * pageSize;

  const orderBy = safeSort(sort, { name: "c.name", laufzeit: "c.start_date", erstellt: "c.created_at" }, "c.created_at");
  const dirSql = dir === "asc" ? sql`asc` : sql`desc`;
  const qLike = q ? `%${q}%` : null;

  const where = sql`
    where c.deleted_at is null
      ${status ? sql`and c.status = ${status}` : sql``}
      ${qLike ? sql`and c.name ilike ${qLike}` : sql``}`;

  const [rowsRaw, [{ count }]] = await Promise.all([
    sql`
      select c.id, c.name, c.platforms, c.status, c.daily_budget_cents,
             c.start_date, c.end_date, c.total_budget_cents,
             coalesce(i.spend,0)::int spend, coalesce(i.impressions,0)::int impressions,
             coalesce(i.clicks,0)::int clicks, coalesce(i.registrations,0)::int registrations
      from admin.ads_campaign c
      left join lateral (
        select sum(spend_cents) spend, sum(impressions) impressions,
               sum(clicks) clicks, sum(registrations) registrations
        from admin.ads_insight where campaign_id = c.id
      ) i on true
      ${where}
      order by ${orderBy} ${dirSql} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int count from admin.ads_campaign c ${where}`,
  ]);

  const rows: DataTableRow[] = rowsRaw.map((c) => {
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const cpc = c.clicks > 0 ? Math.round(c.spend / c.clicks) : null;
    const cpa = c.registrations > 0 ? Math.round(c.spend / c.registrations) : null;
    const platforms = (c.platforms as string[]) ?? [];
    return {
      id: c.id as string,
      href: `/werbung/kampagnen/${c.id}`,
      cells: {
        name: <span className="font-medium">{c.name as string}</span>,
        plattform: (
          <span className="text-xs text-muted-foreground">{platforms.map(platformLabel).join(", ") || "—"}</span>
        ),
        status: <StatusBadge map={CAMPAIGN_STATUS} value={c.status as string} />,
        budget: formatEuroCents(c.daily_budget_cents as number | null),
        spend: c.spend ? formatEuroCents(c.spend) : "—",
        impressions: c.impressions ? formatNumber(c.impressions) : "—",
        clicks: c.clicks ? formatNumber(c.clicks) : "—",
        ctr: c.impressions ? `${ctr.toFixed(2)} %` : "—",
        cpc: cpc != null ? formatEuroCents(cpc) : "—",
        regs: c.registrations ? formatNumber(c.registrations) : "—",
        cpa: cpa != null ? formatEuroCents(cpa) : "—",
        laufzeit: (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {c.start_date ? formatDate(c.start_date as string) : "—"}
            {c.end_date ? ` – ${formatDate(c.end_date as string)}` : ""}
          </span>
        ),
        aktion: (
          <div onClick={(e) => e.stopPropagation()}>
            <CampaignActions c={{
              id: c.id as string, name: c.name as string, status: c.status as string,
              platforms, dailyBudgetCents: c.daily_budget_cents as number | null,
              totalBudgetCents: c.total_budget_cents as number | null,
              startDate: c.start_date as string | null, endDate: c.end_date as string | null,
            }} />
          </div>
        ),
      },
    };
  });

  const connections = allConnections();

  return (
    <div>
      <PageHeader
        title="Kampagnen"
        description="Alle Werbekampagnen im Überblick."
        actions={
          <Button asChild size="sm">
            <Link href="/werbung/kampagnen/neu"><Plus className="size-4" /> Neue Kampagne</Link>
          </Button>
        }
      />
      {!connections.some((c) => c.connected) && <ConnectionBanner connections={connections} />}
      <DataTable
        tableId="ads-campaigns"
        columns={COLUMNS}
        rows={rows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Kampagne suchen…"
        emptyTitle="Noch keine Kampagnen"
        emptyDescription="Lege deine erste Kampagne mit dem Builder an."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={Object.entries(CAMPAIGN_STATUS).map(([value, d]) => ({ value, label: d.label }))}
          />
        }
      />
    </div>
  );
}
