import "server-only";
import {
  META_ENV,
  SNAP_ENV,
  PLATFORMS,
  PLATFORM_BY_ID,
  type Provider,
  type PlatformId,
} from "./platforms";

export interface ConnStatus {
  provider: Provider;
  label: string;
  connected: boolean;
  /** Fehlende Env-Variablen (Namen, KEINE Werte). */
  missing: string[];
  configured: string[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  meta: "Meta (Instagram & Facebook)",
  snapchat: "Snapchat",
};

export function providerConnection(provider: Provider): ConnStatus {
  const vars = provider === "meta" ? META_ENV : SNAP_ENV;
  const missing = vars.filter((v) => !process.env[v]);
  const configured = vars.filter((v) => Boolean(process.env[v]));
  return {
    provider,
    label: PROVIDER_LABEL[provider],
    connected: missing.length === 0,
    missing,
    configured,
  };
}

export function allConnections(): ConnStatus[] {
  return (["meta", "snapchat"] as Provider[]).map(providerConnection);
}

export function platformConnected(id: PlatformId): boolean {
  const p = PLATFORM_BY_ID.get(id);
  return p ? providerConnection(p.provider).connected : false;
}

/** Welche der gewählten Plattformen sind verbunden / welche nicht. */
export function splitByConnection(ids: string[]): {
  connected: string[];
  notConnected: string[];
} {
  const connected: string[] = [];
  const notConnected: string[] = [];
  for (const id of ids) {
    const p = PLATFORMS.find((x) => x.id === id);
    if (p && providerConnection(p.provider).connected) connected.push(id);
    else notConnected.push(id);
  }
  return { connected, notConnected };
}
