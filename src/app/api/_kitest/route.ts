import { NextResponse } from "next/server";
import { extrahiereIntake, kiVerfuegbar } from "@/lib/ki-intake";

export const maxDuration = 60;

/**
 * TEMPORÄRE Verifikationsroute für den ANTHROPIC_API_KEY. Wird nach dem Test
 * wieder entfernt. Zugriff nur mit ?secret=CRON_SECRET.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (
    !process.env.CRON_SECRET ||
    searchParams.get("secret") !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!kiVerfuegbar()) {
    return NextResponse.json({ ok: false, grund: "kein_key_im_deployment" });
  }
  const t0 = Date.now();
  const r = await extrahiereIntake(
    "Testbetrieb Muster GmbH aus Heilbronn, PLZ 74072, seit 2005. Wir suchen einen Elektroniker für Energie- und Gebäudetechnik (m/w/d), 3.200 bis 4.100 Euro im Monat, 30 Tage Urlaub, Firmenwagen. Ansprechpartner: Max Muster, Tel 07131 123456.",
  );
  return NextResponse.json({
    ok: r.ok,
    dauerMs: Date.now() - t0,
    ...(r.ok
      ? {
          firma: r.extraktion.unternehmen.firmenname,
          ort: r.extraktion.unternehmen.ort,
          jobs: r.extraktion.jobs.length,
          erstesJob: r.extraktion.jobs[0]?.title ?? null,
          bereiche: r.extraktion.jobs[0]?.bereiche ?? [],
          gehalt: [r.extraktion.jobs[0]?.salaryMin, r.extraktion.jobs[0]?.salaryMax],
          rueckfragen: r.extraktion.rueckfragen.length,
        }
      : { fehler: r.fehler }),
  });
}
