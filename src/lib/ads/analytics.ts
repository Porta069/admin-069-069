import "server-only";
import { sql } from "@/lib/db";
import { PLATFORMS } from "./platforms";
import { providerConnection } from "./connection";
import { getClient } from "./index";

export interface AdsTotals {
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  registrations: number;
  applications: number;
  ctr: number; // %
  cpcCents: number;
  cpmCents: number;
  cpaCents: number | null;
}

export interface SeriePunkt {
  datum: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  registrations: number;
  cpaCents: number | null;
}

function derive(r: {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  registrations: number;
  applications: number;
}): AdsTotals {
  const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
  const cpc = r.clicks > 0 ? Math.round(r.spend / r.clicks) : 0;
  const cpm = r.impressions > 0 ? Math.round((r.spend / r.impressions) * 1000) : 0;
  const cpa = r.registrations > 0 ? Math.round(r.spend / r.registrations) : null;
  return {
    spendCents: r.spend,
    impressions: r.impressions,
    reach: r.reach,
    clicks: r.clicks,
    conversions: r.conversions,
    registrations: r.registrations,
    applications: r.applications,
    ctr,
    cpcCents: cpc,
    cpmCents: cpm,
    cpaCents: cpa,
  };
}

/** Aggregierte Kennzahlen + Tagesreihe aus admin.ads_insight (leer bis Sync). */
export async function adsKennzahlen(opts: {
  since: string;
  until: string;
  platform?: string | null;
  campaignId?: string | null;
}): Promise<{ totals: AdsTotals; serie: SeriePunkt[]; hatDaten: boolean }> {
  const { since, until, platform, campaignId } = opts;
  const where = sql`
    where i.datum between ${since} and ${until}
      ${platform ? sql`and i.platform = ${platform}` : sql``}
      ${campaignId ? sql`and i.campaign_id = ${campaignId}` : sql``}`;

  const [sum] = await sql`
    select coalesce(sum(spend_cents),0)::bigint spend,
           coalesce(sum(impressions),0)::bigint impressions,
           coalesce(sum(reach),0)::bigint reach,
           coalesce(sum(clicks),0)::bigint clicks,
           coalesce(sum(conversions),0)::bigint conversions,
           coalesce(sum(registrations),0)::bigint registrations,
           coalesce(sum(applications),0)::bigint applications
    from admin.ads_insight i ${where}`;

  const tage = await sql`
    select i.datum::text datum,
           coalesce(sum(spend_cents),0)::int spend,
           coalesce(sum(impressions),0)::int impressions,
           coalesce(sum(clicks),0)::int clicks,
           coalesce(sum(registrations),0)::int registrations
    from admin.ads_insight i ${where}
    group by i.datum order by i.datum asc`;

  const totals = derive({
    spend: Number(sum.spend),
    impressions: Number(sum.impressions),
    reach: Number(sum.reach),
    clicks: Number(sum.clicks),
    conversions: Number(sum.conversions),
    registrations: Number(sum.registrations),
    applications: Number(sum.applications),
  });

  const serie: SeriePunkt[] = tage.map((r) => ({
    datum: r.datum as string,
    spendCents: r.spend as number,
    impressions: r.impressions as number,
    clicks: r.clicks as number,
    registrations: r.registrations as number,
    cpaCents: (r.registrations as number) > 0 ? Math.round((r.spend as number) / (r.registrations as number)) : null,
  }));

  return { totals, serie, hatDaten: tage.length > 0 };
}

/** Heute: geplantes Budget aktiver Kampagnen, Ausgaben heute, Ausgaben Monat. */
export async function adsHeute(): Promise<{
  budgetCents: number;
  spendHeuteCents: number;
  spendMonatCents: number;
}> {
  const [b] = await sql`
    select coalesce(sum(daily_budget_cents),0)::bigint b
    from admin.ads_campaign where status = 'ACTIVE' and deleted_at is null`;
  const [h] = await sql`
    select coalesce(sum(spend_cents),0)::bigint s from admin.ads_insight
    where datum = (now() at time zone 'Europe/Berlin')::date`;
  const [m] = await sql`
    select coalesce(sum(spend_cents),0)::bigint s from admin.ads_insight
    where datum >= date_trunc('month', (now() at time zone 'Europe/Berlin')::date)`;
  return {
    budgetCents: Number(b.b),
    spendHeuteCents: Number(h.s),
    spendMonatCents: Number(m.s),
  };
}

/**
 * Tägliche Synchronisierung der Plattform-Kennzahlen in admin.ads_insight.
 * Überspringt nicht verbundene Plattformen sauber (kein Fehler, keine Fake-Daten).
 * Wird die Live-Anbindung aktiviert, upserted diese Funktion echte Insights.
 */
export async function syncAdsInsights(): Promise<{
  synced: number;
  uebersprungen: string[];
}> {
  const uebersprungen: string[] = [];
  let synced = 0;

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);

  const providers = [...new Set(PLATFORMS.map((p) => p.provider))];
  for (const provider of providers) {
    if (!providerConnection(provider).connected) {
      uebersprungen.push(`${provider} (nicht verbunden)`);
      continue;
    }
    const client = getClient(provider);
    const camps = await sql`
      select id, external_ids from admin.ads_campaign
      where deleted_at is null and (external_ids ->> ${provider}) is not null`;
    if (camps.length === 0) {
      uebersprungen.push(`${provider} (keine live-verknüpften Kampagnen)`);
      continue;
    }
    for (const c of camps) {
      const extId = (c.external_ids as Record<string, string> | null)?.[provider];
      if (!extId) continue;
      try {
        const rows = await client.getInsights(extId, sinceStr, untilStr);
        for (const r of rows) {
          await sql`
            insert into admin.ads_insight
              (campaign_id, platform, ad_set_id, ad_id, datum, spend_cents,
               impressions, reach, clicks, conversions, registrations, applications)
            values (${c.id}, ${provider}, '', '', ${r.date}, ${r.spendCents},
                    ${r.impressions}, ${r.reach}, ${r.clicks}, ${r.conversions},
                    ${r.registrations}, ${r.applications})
            on conflict (campaign_id, platform, ad_set_id, ad_id, datum) do update set
              spend_cents = excluded.spend_cents, impressions = excluded.impressions,
              reach = excluded.reach, clicks = excluded.clicks,
              conversions = excluded.conversions, registrations = excluded.registrations,
              applications = excluded.applications`;
          synced++;
        }
      } catch (e) {
        uebersprungen.push(`${provider}/${extId} (Fehler: ${(e as Error).message})`);
      }
    }
  }
  return { synced, uebersprungen };
}
