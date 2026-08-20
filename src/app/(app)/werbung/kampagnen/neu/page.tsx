import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { PLATFORMS, BERUFE_OPTIONS } from "@/lib/ads/platforms";
import { providerConnection } from "@/lib/ads/connection";
import { CampaignBuilder } from "../../_components/campaign-builder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Neue Kampagne" };

export default async function NeueKampagnePage() {
  await requireEmployee("communication");

  const connectedPlatforms = PLATFORMS
    .filter((p) => providerConnection(p.provider).connected)
    .map((p) => p.id);

  const creatives = await sql`
    select id, name, typ, url, aspect_ratio
    from admin.ads_creative where deleted_at is null
    order by created_at desc limit 100`;

  return (
    <div>
      <PageHeader
        title="Neue Kampagne"
        description="In 7 Schritten zur fertigen Kampagne. Es wird nichts geschaltet, bis du bewusst veröffentlichst."
      />
      <CampaignBuilder
        connectedPlatforms={connectedPlatforms}
        berufeOptions={BERUFE_OPTIONS}
        creatives={creatives.map((c) => ({
          id: c.id as string, name: c.name as string, typ: c.typ as string,
          url: c.url as string | null, aspect_ratio: c.aspect_ratio as string | null,
        }))}
        defaultLanding="https://porta-jobs.de/registrieren"
      />
    </div>
  );
}
