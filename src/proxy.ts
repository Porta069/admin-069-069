import { NextResponse, type NextRequest } from "next/server";
import {
  bewerteAnfrage,
  clientIp,
  nurMonitor,
  sicherheitsHeader,
  type FirewallUrteil,
} from "@/lib/firewall";

/**
 * Proxy (Next 16 Middleware): (1) Edge-Firewall (Schicht 1) und
 * (2) schnelle Redirect-Schicht. Echte Auth/Autorisierung passiert weiterhin
 * serverseitig in requireEmployee() — der Proxy ist keine Auth-Grenze, aber die
 * erste Verteidigungslinie gegen Scanner, Exploit-Probes und Fluten.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ip = clientIp((n) => request.headers.get(n));

  // ---- Schicht 1: Edge-WAF -------------------------------------------------
  const urteil = bewerteAnfrage(
    {
      ip,
      pathname,
      method: request.method,
      ua: request.headers.get("user-agent") ?? "",
      search,
      referer: request.headers.get("referer") ?? undefined,
    },
    Date.now(),
  );
  if (urteil) {
    logEreignis(request, ip, urteil); // fire-and-forget
    if (!nurMonitor()) {
      const res = NextResponse.json(
        { error: "forbidden" },
        { status: urteil.status },
      );
      if (urteil.status === 429) res.headers.set("Retry-After", "10");
      setzeHeader(res, request);
      return res;
    }
    // monitor-Modus: nur beobachten, normal weiter.
  }

  // ---- Schicht 2: Redirect-Logik (unverändert) ----------------------------
  const hasSession = request.cookies.has("pw_session");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const weiter = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    setzeHeader(res, request);
    return res;
  };

  // API-Routen NICHT auf /login umleiten — sie authentifizieren serverseitig
  // selbst (401 statt 302). Die WAF/Headers oben gelten trotzdem.
  if (pathname.startsWith("/api/")) return weiter();

  // /login niemals hier umleiten (Cookie kann serverseitig ungültig sein).
  if (pathname === "/login") return weiter();

  if (!hasSession) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    setzeHeader(res, request);
    return res;
  }

  return weiter();
}

/** Gehärtete Header an jede Antwort hängen. */
function setzeHeader(res: NextResponse, request: NextRequest) {
  const istHttps = request.nextUrl.protocol === "https:";
  for (const [k, v] of Object.entries(sicherheitsHeader(istHttps))) {
    res.headers.set(k, v);
  }
}

/** Blockiertes/auffälliges Ereignis an die Node-Senke melden (best effort). */
function logEreignis(
  request: NextRequest,
  ip: string | null,
  urteil: FirewallUrteil,
) {
  const token = process.env.FIREWALL_LOG_TOKEN;
  if (!token) return; // ohne Token kein Edge-Logging (fail-safe, kein Spam)
  try {
    void fetch(new URL("/api/firewall/log", request.url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-fw-token": token },
      body: JSON.stringify({
        ip,
        method: request.method,
        path: request.nextUrl.pathname,
        reason: urteil.reason,
        action: urteil.action,
        ua: (request.headers.get("user-agent") ?? "").slice(0, 300),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* niemals die Antwort wegen Logging scheitern lassen */
  }
}

export const config = {
  // Statische Dateien + interne Endpunkte ausnehmen (inkl. der Firewall-Senke).
  // api/mcp bewusst NICHT ausgenommen → WAF + Rate-Limit gelten dort (schreibfähig!).
  // Nur interne/token-basierte Hochfrequenz-Endpunkte bleiben außen vor.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/cron|api/ical|api/firewall|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|txt|xml|woff2?)).*)",
  ],
};
