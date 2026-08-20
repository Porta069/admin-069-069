import "server-only";

/** Gemeinsames Interface aller Werbe-Plattformen — neue Plattformen
 *  implementieren einfach dieses Interface (siehe meta.ts / snapchat.ts). */

export class AdsNotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} ist nicht verbunden. Bitte zuerst die Zugangsdaten (Env-Variablen) hinterlegen.`);
    this.name = "AdsNotConnectedError";
  }
}

/** Verbunden, aber die Live-API-Anbindung ist noch nicht freigeschaltet. */
export class AdsNotImplementedError extends Error {
  constructor(msg = "Die Live-Anbindung an diese Plattform-API wird nach dem Verbinden freigeschaltet.") {
    super(msg);
    this.name = "AdsNotImplementedError";
  }
}

export interface CampaignPayload {
  name: string;
  ziel: string;
  dailyBudgetCents?: number | null;
  totalBudgetCents?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  targeting: Record<string, unknown>;
  primaertext?: string | null;
  ueberschrift?: string | null;
  beschreibung?: string | null;
  cta?: string | null;
  landingUrl?: string | null;
  creativeUrl?: string | null;
}

export interface InsightRow {
  date: string;
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  registrations: number;
  applications: number;
}

export interface AdPlatformClient {
  readonly provider: string;
  isConnected(): boolean;
  createCampaign(p: CampaignPayload): Promise<{ externalId: string }>;
  updateCampaign(externalId: string, p: Partial<CampaignPayload>): Promise<void>;
  pauseCampaign(externalId: string): Promise<void>;
  resumeCampaign(externalId: string): Promise<void>;
  deleteCampaign(externalId: string): Promise<void>;
  getInsights(externalId: string, since: string, until: string): Promise<InsightRow[]>;
  getAccountBalance(): Promise<{ currency: string; amountCents: number } | null>;
  getSpend(since: string, until: string): Promise<number>;
}
