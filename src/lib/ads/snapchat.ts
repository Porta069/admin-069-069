import "server-only";
import { providerConnection } from "./connection";
import {
  AdsNotConnectedError,
  type AdPlatformClient,
  type CampaignPayload,
  type InsightRow,
} from "./client";

/**
 * Snapchat Marketing API — echte Anbindung. Alle Aufrufe laufen serverseitig.
 * Der kurzlebige Access Token (~1 h) wird automatisch aus dem langlebigen
 * Refresh Token erneuert; Zugangsdaten kommen ausschließlich aus Env-Variablen.
 * Beträge liefert Snapchat in „micro" (1 Währungseinheit = 1.000.000 micro →
 * 1 Cent = 10.000 micro).
 */
const OAUTH = "https://accounts.snapchat.com/login/oauth2/access_token";
const API = "https://adsapi.snapchat.com/v1";

const microToCents = (micro: number) => Math.round((Number(micro) || 0) / 10000);

// Access-Token-Cache über Requests hinweg (pro Lambda-Instanz).
declare global {
  // eslint-disable-next-line no-var
  var __snapToken: { token: string; expiresAt: number } | undefined;
}

async function accessToken(): Promise<string> {
  const cached = globalThis.__snapToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const body = new URLSearchParams({
    client_id: process.env.SNAPCHAT_CLIENT_ID as string,
    client_secret: process.env.SNAPCHAT_CLIENT_SECRET as string,
    grant_type: "refresh_token",
    refresh_token: process.env.SNAPCHAT_REFRESH_TOKEN as string,
  });
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Snapchat-Login fehlgeschlagen (${res.status}). Prüfe Client-ID/Secret/Refresh-Token. ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (json.expires_in ?? 3600) * 1000;
  globalThis.__snapToken = { token: json.access_token, expiresAt: Date.now() + ttl };
  return json.access_token;
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = await accessToken();
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) {
    const msg = (json as { debug_message?: string })?.debug_message ?? text.slice(0, 300);
    throw new Error(`Snapchat-API ${res.status}: ${msg}`);
  }
  return json;
}

/** Offset (z. B. „-07:00") einer IANA-Zeitzone zum gegebenen Datum. */
function zoneOffset(tz: string, date: Date): string {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
    const m = s.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : "+00:00";
  } catch {
    return "+00:00";
  }
}
/** Snapchat-Stats verlangen auf Tagesgrenzen ausgerichtete Zeiten in Konto-TZ. */
function dayIso(dateStr: string, tz: string): string {
  return `${dateStr}T00:00:00.000${zoneOffset(tz, new Date(`${dateStr}T12:00:00Z`))}`;
}

export class SnapchatAdsClient implements AdPlatformClient {
  readonly provider = "snapchat";

  isConnected(): boolean {
    return providerConnection("snapchat").connected;
  }
  private guard() {
    if (!this.isConnected()) throw new AdsNotConnectedError("Snapchat");
  }
  private accountId() {
    return process.env.SNAPCHAT_AD_ACCOUNT_ID as string;
  }

  /** Verbindungstest: bestätigt Login + liest das Werbekonto. */
  async testConnection(): Promise<{
    ok: boolean;
    accountName?: string;
    currency?: string;
    status?: string;
    timezone?: string;
    message?: string;
  }> {
    try {
      this.guard();
      const data = await api<{ adaccounts: { adaccount: { name: string; currency: string; status: string; timezone: string } }[] }>(
        `/adaccounts/${this.accountId()}`,
      );
      const acc = data.adaccounts?.[0]?.adaccount;
      if (!acc) return { ok: false, message: "Werbekonto nicht gefunden. Prüfe die Ad-Account-ID." };
      return { ok: true, accountName: acc.name, currency: acc.currency, status: acc.status, timezone: acc.timezone };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  private async accountTimezone(): Promise<string> {
    try {
      const data = await api<{ adaccounts: { adaccount: { timezone: string } }[] }>(`/adaccounts/${this.accountId()}`);
      return data.adaccounts?.[0]?.adaccount?.timezone ?? "UTC";
    } catch {
      return "UTC";
    }
  }

  async createCampaign(p: CampaignPayload): Promise<{ externalId: string }> {
    this.guard();
    const start = p.startDate ? `${p.startDate}T00:00:00.000Z` : new Date().toISOString();
    const data = await api<{ campaigns: { campaign: { id: string } }[] }>(
      `/adaccounts/${this.accountId()}/campaigns`,
      {
        method: "POST",
        // Bewusst PAUSED anlegen — echte Auslieferung erst nach Aktivierung.
        body: { campaigns: [{ ad_account_id: this.accountId(), name: p.name, status: "PAUSED", start_time: start }] },
      },
    );
    const id = data.campaigns?.[0]?.campaign?.id;
    if (!id) throw new Error("Snapchat hat keine Kampagnen-ID zurückgegeben.");
    return { externalId: id };
  }

  async updateCampaign(externalId: string, p: Partial<CampaignPayload>): Promise<void> {
    this.guard();
    await api(`/adaccounts/${this.accountId()}/campaigns`, {
      method: "PUT",
      body: { campaigns: [{ id: externalId, ...(p.name ? { name: p.name } : {}) }] },
    });
  }

  private async setStatus(externalId: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
    this.guard();
    await api(`/adaccounts/${this.accountId()}/campaigns`, {
      method: "PUT",
      body: { campaigns: [{ id: externalId, status }] },
    });
  }
  async pauseCampaign(externalId: string): Promise<void> {
    await this.setStatus(externalId, "PAUSED");
  }
  async resumeCampaign(externalId: string): Promise<void> {
    await this.setStatus(externalId, "ACTIVE");
  }
  async deleteCampaign(externalId: string): Promise<void> {
    this.guard();
    await api(`/campaigns/${externalId}`, { method: "DELETE" });
  }

  async getInsights(externalId: string, since: string, until: string): Promise<InsightRow[]> {
    this.guard();
    const tz = await this.accountTimezone();
    const data = await api<{
      timeseries_stats: { timeseries_stat: { timeseries: { start_time: string; stats: Record<string, number> }[] } }[];
    }>(`/campaigns/${externalId}/stats`, {
      query: {
        granularity: "DAY",
        fields: "impressions,spend,swipes",
        start_time: dayIso(since, tz),
        end_time: dayIso(until, tz),
      },
    });
    const series = data.timeseries_stats?.[0]?.timeseries_stat?.timeseries ?? [];
    return series.map((pt) => ({
      date: pt.start_time.slice(0, 10),
      spendCents: microToCents(pt.stats.spend ?? 0),
      impressions: Number(pt.stats.impressions ?? 0),
      reach: 0,
      clicks: Number(pt.stats.swipes ?? 0),
      conversions: 0,
      registrations: 0,
      applications: 0,
    }));
  }

  async getAccountBalance(): Promise<{ currency: string; amountCents: number } | null> {
    // Karten-/Org-Funding hat kein einfaches Guthaben — bewusst null statt Fehlwert.
    this.guard();
    return null;
  }

  async getSpend(since: string, until: string): Promise<number> {
    this.guard();
    const tz = await this.accountTimezone();
    const data = await api<{ total_stats: { total_stat: { stats: { spend?: number } } }[] }>(
      `/adaccounts/${this.accountId()}/stats`,
      { query: { granularity: "TOTAL", fields: "spend", start_time: dayIso(since, tz), end_time: dayIso(until, tz) } },
    );
    return microToCents(data.total_stats?.[0]?.total_stat?.stats?.spend ?? 0);
  }
}
