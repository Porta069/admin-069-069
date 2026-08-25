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
  referer?: string; // Referer-Header (Header-Injection-Scan)
  origin?: string; // Origin-Header (CSRF-Prüfung für API-Routen)
  host?: string; // Host-Header (Ziel-Abgleich)
}

// Obergrenzen: sehr lange Eingaben vor der Regex kappen (ReDoS-/DoS-Schutz).
const MAX_PFAD = 2048;
const MAX_QUERY = 4096;
const MAX_UA = 512;
const MAX_REFERER = 1024;

/** Mehrfach URL-dekodieren (gegen Doppel-/Dreifach-Kodierungs-Evasion). */
function mehrfachDekodiert(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out;
}

/* --------------------------------------------------------------- Signaturen */

// Bekannte Exploit-/Scan-Pfade. Die App-Routen sind deutschsprachige Wörter,
// daher gibt es hier praktisch keine Kollisionen mit echten Seiten.
const BOESE_PFADE: RegExp[] = [
  /\/\.(env|git|aws|ssh|htaccess|htpasswd|svn|hg|bash_history|npmrc|vscode|idea|DS_Store)\b/i,
  /\/(wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc\.php)/i,
  /\/(phpmyadmin|pma|myadmin|adminer|phppgadmin|dbadmin|mysql)/i,
  /\/(cgi-bin|shellshock|struts|actuator|solr|jenkins|weblogic|hudson|jmx-console)/i,
  /\/(vendor\/phpunit|eval-stdin\.php|wp-config|config\.php|\.env\.|_ignition|_profiler|telescope|server-status|server-info)/i,
  /\.(sql|bak|old|swp|zip|tar|tgz|gz|rar|7z|env|ini|log|pem|key|p12|pfx)(\?|$)/i,
  /(\.\.\/|\.\.%2f|%2e%2e%2f|%2e%2e\/|%252e%252e|\/etc\/passwd|\/proc\/self|\/windows\/win\.ini)/i,
  /(%00|\x00)/, // Null-Byte-Injection
];

// Eindeutig bösartige Scanner/Angriffs-Tools. Bewusst KEINE generischen Clients
// (curl, python-requests, go-http-client) — die könnten legitim sein.
const BOESE_UA =
  /(sqlmap|nikto|nmap|masscan|zgrab|nuclei|acunetix|nessus|openvas|dirbuster|gobuster|feroxbuster|dirsearch|ffuf|wpscan|hydra|havij|jorgee|xmrig|zmeu|whatweb|paros|w3af|arachni|metasploit|zaproxy|owasp\s*zap|httrack|scrapy|python-urllib)/i;

// Starke SQLi/XSS-Signaturen im Query-String (dekodiert). Bewusst konservativ.
const BOESE_QUERY =
  /(union(\s|\+|%20)+select|information_schema|\/etc\/passwd|<script\b|onerror\s*=|onload\s*=|<iframe\b|<svg\b|javascript:|document\.cookie|pg_sleep\s*\(|benchmark\s*\(|sleep\s*\(\s*\d|waitfor\s+delay|load_file\s*\(|into\s+outfile|char\(\d)/i;

// Erweiterte Muster (auch in Headern gescannt): Log4Shell, SSRF, Command-Injection,
// Prototype-Pollution, Template-Injection (SSTI), JSP/ASP, NoSQL-Operatoren.
const BOESE_ERWEITERT =
  /(\$\{(jndi|env|lower|upper|sys|date|ctx):|%24%7b|file:\/\/|gopher:\/\/|dict:\/\/|ldap:\/\/|expect:\/\/|\bphp:\/\/(filter|input)|[;|`]\s*(cat|nc|bash|sh|wget|curl|whoami|id|ping|nslookup)\b|\$\((?:cat|id|whoami|curl|wget)|__proto__|constructor\[|prototype\[|\{\{|%7b%7b|<%|%3c%25|\$where\b|\$ne\b|\$regex\b)/i;

const VERBOTENE_METHODEN = new Set(["TRACE", "TRACK", "CONNECT", "DEBUG"]);

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

/**
 * Client-IP. WICHTIG: `x-real-ip` und `x-vercel-forwarded-for` werden von der
 * Vercel-Edge selbst gesetzt und sind NICHT vom Client fälschbar. `x-forwarded-for`
 * kann ein Angreifer prependen (Allowlist-Spoofing) → nur als letzter Fallback,
 * und dort die zuletzt angehängte (vertrauenswürdigste) Adresse.
 */
export function clientIp(get: (name: string) => string | null): string | null {
  const real = get("x-real-ip");
  if (real?.trim()) return real.trim();
  const vercel = get("x-vercel-forwarded-for");
  if (vercel?.trim()) return vercel.split(",")[0]!.trim();
  const xff = get("x-forwarded-for");
  if (xff?.trim()) return xff.split(",")[0]!.trim();
  return null;
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

/** CSRF-Verdacht: State-Changing-Request mit fremdem Origin (nur API-Routen). */
function csrfVerdacht(m: AnfrageMeta): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(m.method)) return false;
  if (!m.pathname.startsWith("/api/")) return false; // Server-Actions prüft Next selbst
  if (!m.origin) return false; // kein Origin (Server-zu-Server) → nicht beurteilbar
  try {
    return new URL(m.origin).host !== (m.host ?? new URL(m.origin).host);
  } catch {
    return true; // kaputter Origin bei State-Change → verdächtig
  }
}

/** Bewertet eine Anfrage. `null` = unauffällig (durchlassen). */
export function bewerteAnfrage(m: AnfrageMeta, now: number): FirewallUrteil | null {
  if (!firewallAktiv()) return null;

  // Vertrauenswürdige IPs umgehen ALLE Prüfungen (Selbstsperre ausgeschlossen).
  if (m.ip && ipTrifft(m.ip, ALLOW_IPS)) return null;

  // Eingaben vor der Regex kappen (ReDoS-/DoS-Schutz bei riesigen URLs).
  const pathname = m.pathname.slice(0, MAX_PFAD);
  const search = m.search.slice(0, MAX_QUERY);
  const ua = m.ua.slice(0, MAX_UA);
  const referer = (m.referer ?? "").slice(0, MAX_REFERER);

  if (m.ip && BLOCK_IPS.length && ipTrifft(m.ip, BLOCK_IPS)) {
    return { block: true, status: 403, reason: "ip_blockliste", action: "BLOCK" };
  }
  if (VERBOTENE_METHODEN.has(m.method)) {
    return { block: true, status: 403, reason: `methode_${m.method.toLowerCase()}`, action: "BLOCK" };
  }
  if (csrfVerdacht(m)) {
    return { block: true, status: 403, reason: "csrf_origin", action: "BLOCK" };
  }
  const pfade = [pathname, mehrfachDekodiert(pathname)];
  if (pfade.some((p) => BOESE_PFADE.some((re) => re.test(p)))) {
    return { block: true, status: 403, reason: "exploit_pfad", action: "BLOCK" };
  }
  if (ua && BOESE_UA.test(ua)) {
    return { block: true, status: 403, reason: "scanner_ua", action: "BLOCK" };
  }
  // Header-basierte Angriffe (Log4Shell, SSRF, Injection über UA/Referer).
  const kopf = `${ua} ${referer}`;
  if (BOESE_ERWEITERT.test(kopf)) {
    return { block: true, status: 403, reason: "header_injection", action: "BLOCK" };
  }
  if (search) {
    const kandidaten = [search, mehrfachDekodiert(search)];
    if (kandidaten.some((v) => BOESE_QUERY.test(v) || BOESE_ERWEITERT.test(v))) {
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
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  // Bewusst OHNE script-src/style-src (die bräuchten Nonces und würden Next
  // brechen). Diese Direktiven sind sicher UND wirksam: Clickjacking-Schutz
  // (frame-ancestors), <base>-Hijack (base-uri), Formular-Exfiltration
  // (form-action) und Plugins/Flash (object-src) werden unterbunden.
  const csp = [
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    istHttps ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
  h["Content-Security-Policy"] = csp;
  if (istHttps) {
    h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return h;
}
