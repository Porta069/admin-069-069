import Link from "next/link";
import { Plus } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { formatEuroCents, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/data-table/filter-select";
import { allConnections } from "@/lib/ads/connection";
import { PLATFORMS } from "@/lib/ads/platforms";
import { adsHeute, adsKennzahlen } from "@/lib/ads/analytics";
import { AdsChart } from "./_components/ads-chart";
import { ConnectionBanner } from "./_components/connection-banner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Werbung" };

const RANGES: Record<string, number> = { "7": 7, "30": 30, "90": 90 };

function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default async function WerbungPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireEmployee("communication");
  const params = await searchParams;
  const rangeKey = RANGES[firstParam(params.range) ?? "30"] ? (firstParam(params.range) ?? "30") : "30";
  const tage = RANGES[rangeKey];
  const platform = firstParam(params.platform) ?? null;

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (tage - 1));

  const connections = allConnections();
  const anyConnected = connections.some((c) => c.connected);

  const [heute, { totals, serie }] = await Promise.all([
    adsHeute(),
    adsKennzahlen({ since: iso(since), until: iso(until), platform }),
  ]);

  const platformOptions = [
    { value: "meta_instagram", label: "Instagram" },
    { value: "meta_facebook", label: "Facebook" },
    { value: "snapchat", label: "Snapchat" },
  ];

  return (
    <div>
      <PageHeader
        title="Werbung"
        description="Zentrale Steuerung aller Werbekampagnen für die Jobbörse."
        actions={
          <Button asChild size="sm">
            <Link href="/werbung/kampagnen/neu"><Plus className="size-4" /> Neue Kampagne</Link>
          </Button>
        }
      />

      {!anyConnected && <ConnectionBanner connections={connections} />}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard accent label="Budget heute (aktiv)" value={formatEuroCents(heute.budgetCents)} hint="Summe aktiver Tagesbudgets" />
        <KpiCard label="Ausgaben heute" value={formatEuroCents(heute.spendHeuteCents)} hint={anyConnected ? undefined : "Sync nach Verbindung"} />
        <KpiCard label="Ausgaben Monat" value={formatEuroCents(heute.spendMonatCents)} />
        <KpiCard label="Registrierungen" value={formatNumber(totals.registrations)} hint={`letzte ${tage} Tage`} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Impressionen" value={formatNumber(totals.impressions)} />
        <KpiCard label="Reichweite" value={formatNumber(totals.reach)} />
        <KpiCard label="Klicks" value={formatNumber(totals.clicks)} />
        <KpiCard label="CTR" value={`${totals.ctr.toFixed(2)} %`} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="CPC" value={formatEuroCents(totals.cpcCents)} />
        <KpiCard label="CPM" value={formatEuroCents(totals.cpmCents)} />
        <KpiCard label="CPA (pro Registrierung)" value={formatEuroCents(totals.cpaCents)} />
        <KpiCard label="Conversions" value={formatNumber(totals.conversions)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Verlauf</h2>
          <p className="text-xs text-muted-foreground">Kennzahl oben umschaltbar.</p>
        </div>
        <div className="flex gap-2">
          <FilterSelect param="platform" placeholder="Alle Plattformen" options={platformOptions} className="h-9 w-44 bg-card" />
          <FilterSelect param="range" placeholder="Zeitraum" options={[
            { value: "7", label: "7 Tage" }, { value: "30", label: "30 Tage" }, { value: "90", label: "90 Tage" },
          ]} className="h-9 w-32 bg-card" />
        </div>
      </div>
      <AdsChart serie={serie} />

      <p className="mt-6 text-xs text-muted-foreground">
        Kennzahlen stammen aus synchronisierten Plattformdaten. Solange eine Plattform nicht verbunden ist,
        werden keine erfundenen Werte angezeigt — die Felder bleiben leer.{" "}
        {PLATFORMS.length} Plattformen vorbereitet.
      </p>
    </div>
  );
}
