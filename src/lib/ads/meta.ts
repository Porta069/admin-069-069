import "server-only";
import { providerConnection } from "./connection";
import {
  AdsNotConnectedError,
  AdsNotImplementedError,
  type AdPlatformClient,
  type CampaignPayload,
  type InsightRow,
} from "./client";

/**
 * Meta Marketing API (Instagram + Facebook). Alle Aufrufe laufen serverseitig
 * über die Env-Zugangsdaten (META_APP_ID/SECRET/ACCESS_TOKEN/AD_ACCOUNT_ID) —
 * niemals im Frontend. Solange die Live-Anbindung nicht freigeschaltet ist,
 * werfen die Methoden einen klaren Fehler statt erfundene Ergebnisse.
 */
const GRAPH = "https://graph.facebook.com/v20.0";

export class MetaAdsClient implements AdPlatformClient {
  readonly provider = "meta";

  isConnected(): boolean {
    return providerConnection("meta").connected;
  }

  private guard() {
    if (!this.isConnected()) throw new AdsNotConnectedError("Meta");
  }

  /** Basis für spätere echte Aufrufe (Access-Token nur serverseitig). */
  protected token() {
    return process.env.META_ACCESS_TOKEN as string;
  }
  protected accountId() {
    return process.env.META_AD_ACCOUNT_ID as string;
  }
  protected base() {
    return GRAPH;
  }

  async createCampaign(_p: CampaignPayload): Promise<{ externalId: string }> {
    this.guard();
    throw new AdsNotImplementedError("Meta-Kampagnen-Erstellung wird nach dem Verbinden freigeschaltet.");
  }
  async updateCampaign(): Promise<void> {
    this.guard();
    throw new AdsNotImplementedError();
  }
  async pauseCampaign(): Promise<void> {
    this.guard();
    throw new AdsNotImplementedError();
  }
  async resumeCampaign(): Promise<void> {
    this.guard();
    throw new AdsNotImplementedError();
  }
  async deleteCampaign(): Promise<void> {
    this.guard();
    throw new AdsNotImplementedError();
  }
  async getInsights(): Promise<InsightRow[]> {
    this.guard();
    throw new AdsNotImplementedError("Meta-Insights-Sync wird nach dem Verbinden freigeschaltet.");
  }
  async getAccountBalance(): Promise<{ currency: string; amountCents: number } | null> {
    this.guard();
    throw new AdsNotImplementedError();
  }
  async getSpend(): Promise<number> {
    this.guard();
    throw new AdsNotImplementedError();
  }
}
