import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { PLATFORMS, BERUFE_OPTIONS } from "@/lib/ads/platforms";
import { providerConnection } from "@/lib/ads/connection";
import {
  CampaignBuilder,
  type CampaignBuilderInitial,
} from "../../../_components/campaign-builder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kampagne bearbeiten" };

export default async function KampagneBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireEmployee("communication");
  const { id } = await params;

  const [c] = await sql`
    select id, name, platforms, ziel, daily_budget_cents, total_budget_cents,
           start_date, targeting, creative_id, primaertext, ueberschrift,
           beschreibung, cta, landing_url, tracking
    from admin.ads_campaign
    where id = ${id} and deleted_at is null
    limit 1`;
  if (!c) notFound();

  const connectedPlatforms = PLATFORMS.filter(
    (p) => providerConnection(p.provider).connected,
  ).map((p) => p.id);

  const creatives = await sql`
    select id, name, typ, url, aspect_ratio
    from admin.ads_creative where deleted_at is null
    order by created_at desc limit 100`;

  // Budget wird als Cent gespeichert; der Builder rechnet in €/Tag × Tage.
  const daily = Number(c.daily_budget_cents ?? 0);
  const total = Number(c.total_budget_cents ?? 0);
  const initial: CampaignBuilderInitial = {
    id: c.id as string,
    name: (c.name as string | null) ?? "",
    platforms: (c.platforms as string[] | null) ?? [],
    ziel: (c.ziel as string | null) ?? "REGISTRATIONS",
    dailyEuro: daily > 0 ? Math.round(daily / 100) : 25,
    tage: daily > 0 && total > 0 ? Math.max(1, Math.round(total / daily)) : 14,
    startDate: c.start_date
      ? new Date(c.start_date as string).toISOString().slice(0, 10)
      : "",
    targeting: (c.targeting ?? {}) as CampaignBuilderInitial["targeting"],
    creativeId: (c.creative_id as string | null) ?? "",
    primaertext: (c.primaertext as string | null) ?? "",
    ueberschrift: (c.ueberschrift as string | null) ?? "",
    beschreibung: (c.beschreibung as string | null) ?? "",
    cta: (c.cta as string | null) ?? "SIGN_UP",
    landingUrl: (c.landing_url as string | null) ?? "",
    tracking: (c.tracking ?? {}) as CampaignBuilderInitial["tracking"],
  };

  return (
    <div>
      <PageHeader
        title="Kampagne bearbeiten"
        description="Passe die Kampagne an. Änderungen werden gespeichert — geschaltet wird erst beim Veröffentlichen."
      />
      <CampaignBuilder
        connectedPlatforms={connectedPlatforms}
        berufeOptions={BERUFE_OPTIONS}
        creatives={creatives.map((cr) => ({
          id: cr.id as string,
          name: cr.name as string,
          typ: cr.typ as string,
          url: cr.url as string | null,
          aspect_ratio: cr.aspect_ratio as string | null,
        }))}
        defaultLanding="https://werkpair.de/registrieren"
        initial={initial}
      />
    </div>
  );
}
