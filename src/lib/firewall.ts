/**
 * Edge-WAF-Kern (Schicht 1). Läuft im Next-16-Proxy am Edge — daher rein,
 * zustandsarm und OHNE DB/Node-APIs. Alles ist fail-open: im Zweifel wird
 * durchgelassen, nie legitimer Admin-Traffic blockiert.
 *
 * Steuerung per Env:
 *  - FIREWALL_ENABLED   "false" schaltet die Firewall komplett ab (Kill-Switch)
 *  - FIREWALL_MODE      "monitor" = nur erkennen/loggen, NICHT blockieren
 *  - FIREWALL_ALLOW_IPS Kommaliste vertrauenswürdiger IPs/Präfixe (Bypass)
 *  - FIREWALL_BLOCK_IPS Kommaliste dauerhaft gesperrter IPs/Präfixe
 *  - FIREWALL_RL_LIMIT  allg. Rate-Limit (Requests je Fenster, Standard 240)
 *  - FIREWALL_RL_WINDOW Fenster in ms (Standard 10000)
 */

export type FirewallAktion = "BLOCK" | "RATE_LIMIT" | "MONITOR";

export interface FirewallUrteil {
  block: boolean; // true = blockieren (im block-Modus)
  status: number; // 403 | 429
  reason: string;
  action: FirewallAktion;
}

export interface AnfrageMeta {
  ip: string | null;
  pathname: string;
  method: string;
  ua: string;
  search: string; // roher Query-String inkl. „?"
}

/* --------------------------------------------------------------- Signaturen */

// Bekannte Exploit-/Scan-Pfade. Die App-Routen sind deutschsprachige Wörter,
// daher gibt es hier praktisch keine Kollisionen mit echten Seiten.
const BOESE_PFADE: RegExp[] = [
  /\/\.(env|git|aws|ssh|htaccess|htpasswd|svn|hg|bash_history|npmrc)\b/i,
  /\/(wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc\.php)/i,
  /\/(phpmyadmin|pma|myadmin|adminer|phppgadmin|dbadmin)/i,
  /\/(cgi-bin|shellshock|struts|actuator|solr|jenkins|weblogic|hudson)/i,
  /\/(vendor\/phpunit|eval-stdin\.php|wp-config|config\.php|\.env\.)/i,
  /\.(sql|bak|old|swp|zip|tar|tgz|gz|rar|7z|env|ini|log)(\?|$)/i,
  /(\.\.\/|\.\.%2f|%2e%2e%2f|%2e%2e\/|\/etc\/passwd|\/proc\/self)/i,
];

// Eindeutig bösartige Scanner/Angriffs-Tools. Bewusst KEINE generischen Clients
// (curl, python-requests, go-http-client) — die könnten legitim sein.
const BOESE_UA =
  /(sqlmap|nikto|nmap|masscan|zgrab|nuclei|acunetix|nessus|openvas|dirbuster|gobuster|feroxbuster|wpscan|hydra|havij|jorgee|xmrig|semrushbot|petalbot|censys|zmeu)/i;

// Starke Injection-Signaturen im Query-String (dekodiert). Bewusst konservativ.
const BOESE_QUERY =
  /(union(\s|\+|%20)+select|information_schema|\/etc\/passwd|<script\b|onerror\s*=|javascript:|pg_sleep\s*\(|benchmark\s*\(|waitfor\s+delay|load_file\s*\(|into\s+outfile|char\(\d)/i;

const VERBOTENE_METHODEN = new Set(["TRACE", "TRACK", "CONNECT"]);

/* ------------------------------------------------------------------ Env-Setup */

function envListe(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ALLOW_IPS = envListe("FIREWALL_ALLOW_IPS");
const BLOCK_IPS = envListe("FIREWALL_BLOCK_IPS");
const RL_LIMIT = Number(process.env.FIREWALL_RL_LIMIT ?? "240");
const RL_WINDOW = Number(process.env.FIREWALL_RL_WINDOW ?? "10000");

export function firewallAktiv(): boolean {
  return process.env.FIREWALL_ENABLED !== "false";
}
export function nurMonitor(): boolean {
  return process.env.FIREWALL_MODE === "monitor";
}

/** IP/Präfix-Treffer: exakte Gleichheit oder Präfix (z. B. „203.0.113."). */
function ipTrifft(ip: string, muster: string[]): boolean {
  return muster.some((m) => ip === m || (m.endsWith(".") && ip.startsWith(m)));
}

/** Client-IP aus den üblichen Proxy-Headern (Vercel: x-forwarded-for). */
export function clientIp(get: (name: string) => string | null): string | null {
  const xff = get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return get("x-real-ip") || get("x-vercel-forwarded-for") || null;
}

/* --------------------------------------------------------- Rate-Limiter (RAM) */

// Bestes verfügbares Mittel am Edge: Sliding-Window pro warmer Instanz.
// Kein perfekt verteilter Zähler, aber wirksame erste Verteidigungslinie.
const buckets = new Map<string, number[]>();

function ueberLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  const cutoff = now - windowMs;
  const arr = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  buckets.set(key, arr);
  // Gelegentliches Aufräumen, damit die Map nicht unbegrenzt wächst.
  if (buckets.size > 4000) {
    for (const [k, v] of buckets) {
      if (!v.length || v[v.length - 1]! < cutoff) buckets.delete(k);
    }
  }
  return arr.length > limit;
}

/** Strengere Limits für sensible Pfade (Login/MCP) — Brute-Force-Bremse. */
function istSensibel(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/auth")
  );
}

/* -------------------------------------------------------------- Hauptbewertung */

/** Bewertet eine Anfrage. `null` = unauffällig (durchlassen). */
export function bewerteAnfrage(m: AnfrageMeta, now: number): FirewallUrteil | null {
  if (!firewallAktiv()) return null;

  // Vertrauenswürdige IPs umgehen ALLE Prüfungen (Selbstsperre ausgeschlossen).
  if (m.ip && ipTrifft(m.ip, ALLOW_IPS)) return null;

  if (m.ip && BLOCK_IPS.length && ipTrifft(m.ip, BLOCK_IPS)) {
    return { block: true, status: 403, reason: "ip_blockliste", action: "BLOCK" };
  }
  if (VERBOTENE_METHODEN.has(m.method)) {
    return { block: true, status: 403, reason: `methode_${m.method.toLowerCase()}`, action: "BLOCK" };
  }
  if (BOESE_PFADE.some((re) => re.test(m.pathname))) {
    return { block: true, status: 403, reason: "exploit_pfad", action: "BLOCK" };
  }
  if (m.ua && BOESE_UA.test(m.ua)) {
    return { block: true, status: 403, reason: "scanner_ua", action: "BLOCK" };
  }
  if (m.search) {
    let dekodiert = m.search;
    try {
      dekodiert = decodeURIComponent(m.search);
    } catch {
      /* fehlerhafte Kodierung → Rohwert prüfen */
    }
    if (BOESE_QUERY.test(dekodiert) || BOESE_QUERY.test(m.search)) {
      return { block: true, status: 403, reason: "injection_query", action: "BLOCK" };
    }
  }

  // Rate-Limit (nur mit bekannter IP sinnvoll).
  if (m.ip) {
    const sensibel = istSensibel(m.pathname);
    const limit = sensibel ? Math.max(20, Math.floor(RL_LIMIT / 6)) : RL_LIMIT;
    const key = `${sensibel ? "s" : "g"}:${m.ip}`;
    if (ueberLimit(key, limit, RL_WINDOW, now)) {
      return { block: true, status: 429, reason: "rate_limit", action: "RATE_LIMIT" };
    }
  }

  return null;
}

/** Gehärtete Sicherheits-Header für JEDE Antwort (kein CSP → keine Next-Brüche). */
export function sicherheitsHeader(istHttps: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "off",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (istHttps) {
    h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return h;
}
