import "server-only";
import { PLATFORM_BY_ID, type Provider, type PlatformId } from "./platforms";
import type { AdPlatformClient } from "./client";
import { MetaAdsClient } from "./meta";
import { SnapchatAdsClient } from "./snapchat";

const clients: Record<Provider, AdPlatformClient> = {
  meta: new MetaAdsClient(),
  snapchat: new SnapchatAdsClient(),
};

export function getClient(provider: Provider): AdPlatformClient {
  return clients[provider];
}

export function getClientForPlatform(platformId: string): AdPlatformClient | null {
  const p = PLATFORM_BY_ID.get(platformId as PlatformId);
  return p ? clients[p.provider] : null;
}

export * from "./client";
export * from "./connection";
