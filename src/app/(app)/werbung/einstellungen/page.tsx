import { Bell, Clock, PauseCircle, ShieldAlert } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { TRACKING_EVENTS } from "@/lib/ads/platforms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Werbe-Einstellungen" };

const AUTOMATIONS = [
  { icon: PauseCircle, title: "Auto-Pause bei Budgetgrenze", desc: "Kampagne pausiert automatisch, sobald das Tagesbudget erreicht ist." },
  { icon: ShieldAlert, title: "Warnung bei hohen Kosten / hohem CPA", desc: "Benachrichtigung im Dashboard, wenn Ausgaben oder CPA einen Schwellwert überschreiten." },
  { icon: Clock, title: "Täglicher Performance-Sync", desc: "Ruft einmal täglich die Kennzahlen aller verbundenen Plattformen ab." },
  { icon: Bell, title: "Täglicher Report", desc: "Kurze Tageszusammenfassung der wichtigsten Kennzahlen." },
];

export default async function WerbeEinstellungenPage() {
  await requireEmployee("communication");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Werbe-Einstellungen"
        description="Tracking-Standards und Automatisierungen der Werbe-Abteilung."
      />

      <section className="mb-8">
        <h2 className="mb-1 font-display text-base font-semibold">Tracking-Events</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Diese Conversion-Events der Jobbörse stehen für Meta- und Snapchat-Pixel/CAPI bereit und lassen sich je
          Kampagne aktivieren.
        </p>
        <div className="flex flex-wrap gap-2">
          {TRACKING_EVENTS.map((e) => (
            <span key={e} className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium">{e}</span>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-base font-semibold">Landingpage & UTM</h2>
        <p className="text-sm text-muted-foreground">
          Beim Veröffentlichen werden an die Ziel-URL automatisch Tracking-Parameter angehängt
          (<code className="text-xs">utm_source</code>, <code className="text-xs">utm_medium</code>,{" "}
          <code className="text-xs">utm_campaign</code>), damit Registrierungen der richtigen Kampagne zugeordnet werden.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-display text-base font-semibold">Automatisierungen</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Vorbereitet — aktiv, sobald mindestens eine Plattform verbunden ist. Benachrichtigungen erscheinen im
          Admin-Dashboard.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AUTOMATIONS.map((a) => (
            <div key={a.title} className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <a.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>
                <span className="mt-1.5 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Vorbereitet
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
