import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Node-Senke für Edge-Firewall-Ereignisse. Wird ausschließlich vom Proxy per
 * fire-and-forget aufgerufen und ist durch ein geheimes Token geschützt
 * (FIREWALL_LOG_TOKEN). Ohne Token: 204 (kein Logging, kein Fehler).
 */
export async function POST(req: Request) {
  const token = process.env.FIREWALL_LOG_TOKEN;
  if (!token || req.headers.get("x-fw-token") !== token) {
    return new NextResponse(null, { status: 204 });
  }
  let b: {
    ip?: string;
    method?: string;
    path?: string;
    reason?: string;
    action?: string;
    ua?: string;
  } = {};
  try {
    b = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const aktion =
    b.action && ["BLOCK", "MONITOR", "RATE_LIMIT"].includes(b.action)
      ? b.action
      : "BLOCK";
  try {
    await sql`
      insert into admin.firewall_event (ip, method, path, reason, action, user_agent)
      values (${b.ip?.slice(0, 64) ?? null}, ${b.method?.slice(0, 12) ?? null},
              ${b.path?.slice(0, 512) ?? null}, ${(b.reason ?? "unbekannt").slice(0, 64)},
              ${aktion}, ${b.ua?.slice(0, 300) ?? null})`;
  } catch {
    // Logging ist best effort — niemals einen Fehler zurückspielen.
  }
  return new NextResponse(null, { status: 204 });
}
