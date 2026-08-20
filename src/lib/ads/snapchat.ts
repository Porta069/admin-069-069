import "server-only";
import { providerConnection } from "./connection";
import {
  AdsNotConnectedError,
  AdsNotImplementedError,
  type AdPlatformClient,
  type CampaignPayload,
  type InsightRow,
} from "./client";

/** Snapchat Marketing API. Analog zu Meta — Zugang nur serverseitig über Env. */
const SNAP = "https://adsapi.snapchat.com/v1";

export class SnapchatAdsClient implements AdPlatformClient {
  readonly provider = "snapchat";

  isConnected(): boolean {
    return providerConnection("snapchat").connected;
  }
  private guard() {
    if (!this.isConnected()) throw new AdsNotConnectedError("Snapchat");
  }
  protected token() {
    return process.env.SNAPCHAT_ACCESS_TOKEN as string;
  }
  protected accountId() {
    return process.env.SNAPCHAT_AD_ACCOUNT_ID as string;
  }
  protected base() {
    return SNAP;
  }

  async createCampaign(_p: CampaignPayload): Promise<{ externalId: string }> {
    this.guard();
    throw new AdsNotImplementedError("Snapchat-Kampagnen-Erstellung wird nach dem Verbinden freigeschaltet.");
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
    throw new AdsNotImplementedError("Snapchat-Insights-Sync wird nach dem Verbinden freigeschaltet.");
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
