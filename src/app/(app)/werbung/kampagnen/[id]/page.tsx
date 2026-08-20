import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatEuroCents, formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STATUS, platformLabel, ZIELE, CTAS } from "@/lib/ads/platforms";
import { adsKennzahlen } from "@/lib/ads/analytics";
import { AdsChart } from "../../_components/ads-chart";
import { CampaignActions } from "../../_components/campaign-actions";

export const dynamic = "force-dynamic";

export default async function KampagneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEmployee("communication");
  const { id } = await params;

  const [c] = await sql`
    select * from admin.ads_campaign where id = ${id} and deleted_at is null`;
  if (!c) notFound();

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 89);
  const { totals, serie } = await adsKennzahlen({ since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), campaignId: id });

  // "Was funktioniert am besten?" – nur echte Daten, sonst ehrlicher Hinweis.
  const proPlattform = await sql`
    select platform, sum(spend_cents)::int spend, sum(registrations)::int regs
    from admin.ads_insight where campaign_id = ${id}
    group by platform order by regs desc`;
  const bestePlattform = proPlattform.find((p) => (p.regs as number) > 0);

  const platforms = (c.platforms as string[]) ?? [];
  const tg = (c.targeting ?? {}) as Record<string, unknown>;
  const budgetGenutzt = c.total_budget_cents ? Math.min(100, Math.round((totals.spendCents / (c.total_budget_cents as number)) * 100)) : 0;

  return (
    <div>
      <Link href="/werbung/kampagnen" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Kampagnen
      </Link>
      <PageHeader
        title={c.name as string}
        description={`${platforms.map(platformLabel).join(", ") || "—"} · Ziel: ${ZIELE.find((z) => z.value === c.ziel)?.label ?? c.ziel}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge map={CAMPAIGN_STATUS} value={c.status as string} />
            <CampaignActions c={{
              id: c.id as string, name: c.name as string, status: c.status as string, platforms,
              dailyBudgetCents: c.daily_budget_cents as number | null,
              totalBudgetCents: c.total_budget_cents as number | null,
              startDate: c.start_date as string | null, endDate: c.end_date as string | null,
            }} />
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard accent label="Ausgaben" value={formatEuroCents(totals.spendCents)} hint={`von ${formatEuroCents(c.total_budget_cents as number | null)}`} />
        <KpiCard label="Impressionen" value={formatNumber(totals.impressions)} />
        <KpiCard label="Klicks" value={formatNumber(totals.clicks)} hint={`CTR ${totals.ctr.toFixed(2)} %`} />
        <KpiCard label="Registrierungen" value={formatNumber(totals.registrations)} hint={totals.cpaCents != null ? `CPA ${formatEuroCents(totals.cpaCents)}` : undefined} />
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">Budgetnutzung</span>
          <span className="text-muted-foreground">{budgetGenutzt}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${budgetGenutzt}%` }} />
        </div>
      </div>

      <div className="mb-6"><AdsChart serie={serie} /></div>

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard title="Zielgruppe">
          <Kv k="Länder" v={(tg.laender as string[])?.join(", ") || "—"} />
          <Kv k="Regionen" v={(tg.regionen as string) || "—"} />
          <Kv k="Städte" v={(tg.staedte as string) || "—"} />
          <Kv k="Alter" v={tg.ageMin != null ? `${tg.ageMin}–${tg.ageMax}` : "—"} />
          <Kv k="Geschlecht" v={(tg.gender as string) === "male" ? "Männlich" : (tg.gender as string) === "female" ? "Weiblich" : "Alle"} />
          <Kv k="Berufe" v={(tg.berufe as string[])?.length ? `${(tg.berufe as string[]).length} gewählt` : "—"} />
        </InfoCard>

        <InfoCard title="Anzeige">
          <Kv k="Überschrift" v={(c.ueberschrift as string) || "—"} />
          <Kv k="Primärtext" v={(c.primaertext as string) || "—"} />
          <Kv k="CTA" v={CTAS.find((x) => x.value === c.cta)?.label ?? (c.cta as string)} />
          <Kv k="Landingpage" v={(c.landing_url as string) || "—"} />
          <Kv k="Laufzeit" v={`${c.start_date ? formatDate(c.start_date as string) : "—"}${c.end_date ? ` – ${formatDate(c.end_date as string)}` : ""}`} />
        </InfoCard>

        <InfoCard title="Was funktioniert am besten?">
          {bestePlattform ? (
            <div className="space-y-1 text-sm">
              <p>Beste Plattform: <span className="font-medium">{platformLabel(bestePlattform.platform as string)}</span></p>
              <p className="text-muted-foreground">{formatNumber(bestePlattform.regs as number)} Registrierungen bei {formatEuroCents(bestePlattform.spend as number)} Ausgaben.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch keine Performance-Daten. Sobald die Kampagne läuft und synchronisiert ist, zeigen wir hier die
              stärkste Plattform, Zielgruppe und das beste Creative — auf Basis echter Zahlen.
            </p>
          )}
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="truncate text-right font-medium" title={v}>{v}</span>
    </div>
  );
}
