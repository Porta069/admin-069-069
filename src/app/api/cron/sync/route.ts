import { NextResponse } from "next/server";
import { runSyncThrottled } from "@/lib/sync";

export const maxDuration = 120;

/**
 * Sync-Endpunkt für Vercel Cron und manuelle Auslösung.
 * Zugriff: Vercel-Cron-User-Agent ODER ?secret=CRON_SECRET.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  const authorized =
    ua.startsWith("vercel-cron/") ||
    (process.env.CRON_SECRET &&
      searchParams.get("secret") === process.env.CRON_SECRET);

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ran = await runSyncThrottled();
  return NextResponse.json({ ok: true, ran });
}
