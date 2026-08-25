import "server-only";
import { headers } from "next/headers";
import { sql } from "./db";
import { clientIp } from "./firewall";

/**
 * Node-Schicht der Firewall: dynamische IP-Regeln (admin.firewall_rule) werden
 * hier durchgesetzt, weil der Edge-Proxy die DB nicht lesen kann. Regeln sind
 * 30 s gecacht (eine DB-Abfrage je halbe Minute statt pro Request).
 */

interface Regel {
  rule_type: "BLOCK_IP" | "ALLOW_IP";
  pattern: string;
}

let cache: { at: number; regeln: Regel[] } | null = null;
const TTL_MS = 30_000;

async function ladeRegeln(): Promise<Regel[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.regeln;
  try {
    const rows = (await sql`
      select rule_type, pattern from admin.firewall_rule
      where enabled = true and deleted_at is null`) as Regel[];
    cache = { at: now, regeln: rows };
    return rows;
  } catch {
    return cache?.regeln ?? [];
  }
}

/** Cache leeren — nach dem Anlegen/Löschen einer Regel aufrufen. */
export function invalidiereFirewallCache(): void {
  cache = null;
}

function trifft(ip: string, pattern: string): boolean {
  return ip === pattern || (pattern.endsWith(".") && ip.startsWith(pattern));
}

/** Aktuelle Client-IP aus den Request-Headern (server-seitig). */
export async function aktuelleClientIp(): Promise<string | null> {
  const h = await headers();
  return clientIp((n) => h.get(n));
}

/** IP dynamisch gebannt? ALLOW_IP hat Vorrang vor BLOCK_IP (Selbstschutz). */
export async function istIpGebannt(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const regeln = await ladeRegeln();
  if (regeln.some((r) => r.rule_type === "ALLOW_IP" && trifft(ip, r.pattern))) {
    return false;
  }
  return regeln.some((r) => r.rule_type === "BLOCK_IP" && trifft(ip, r.pattern));
}

// Ereignis-Entprellung: dieselbe IP nicht mehrfach je Minute protokollieren.
const zuletzt = new Map<string, number>();

/** Firewall-Ereignis in der Node-Schicht protokollieren (best effort, entprellt). */
export async function protokolliereFirewall(e: {
  ip: string | null;
  method?: string | null;
  path?: string | null;
  reason: string;
  action?: "BLOCK" | "MONITOR" | "RATE_LIMIT";
}): Promise<void> {
  const key = `${e.ip ?? "?"}:${e.reason}`;
  const now = Date.now();
  if ((zuletzt.get(key) ?? 0) > now - 60_000) return;
  zuletzt.set(key, now);
  try {
    await sql`
      insert into admin.firewall_event (ip, method, path, reason, action, user_agent)
      values (${e.ip}, ${e.method ?? null}, ${e.path ?? null}, ${e.reason},
              ${e.action ?? "BLOCK"}, null)`;
  } catch {
    /* best effort */
  }
}
