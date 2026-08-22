import { NextResponse } from "next/server";
import { runSyncThrottled } from "@/lib/sync";

export const maxDuration = 120;

/**
 * Sync-Endpunkt für Vercel Cron und manuelle Auslösung.
 * Zugriff: Vercel-Cron-User-Agent ODER ?secret=CRON_SECRET.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  // Ist ein CRON_SECRET gesetzt, ist es Pflicht (Vercel-Cron sendet es als
  // `Authorization: Bearer <CRON_SECRET>`; ?secret= bleibt als manueller Weg).
  // Der fälschbare User-Agent zählt NUR noch, wenn gar kein Secret gesetzt ist.
  const auth = request.headers.get("authorization") ?? "";
  const ua = request.headers.get("user-agent") ?? "";
  const authorized = secret
    ? auth === `Bearer ${secret}` || searchParams.get("secret") === secret
    : ua.startsWith("vercel-cron/");

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ran = await runSyncThrottled();
  return NextResponse.json({ ok: true, ran });
}
