import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { allConnections } from "@/lib/ads/connection";
import { PLATFORMS } from "@/lib/ads/platforms";
import { TestConnectionButton } from "../_components/test-connection-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verbindungen" };

export default async function VerbindungenPage() {
  await requireEmployee("communication");
  const connections = allConnections();

  return (
    <div>
      <PageHeader
        title="Plattform-Verbindungen"
        description="Status der Werbe-APIs. Zugangsdaten liegen ausschließlich serverseitig als Umgebungsvariablen."
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft/40 p-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-info" />
        <div>
          <p className="text-sm font-medium text-info">Sicherheit</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            API-Zugangsdaten werden niemals im Frontend, Browser oder in GitHub gespeichert. Alle Aufrufe an Meta
            und Snapchat laufen ausschließlich über das Backend. Hier siehst du nur die <em>Namen</em> der
            benötigten Variablen — niemals deren Werte.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {connections.map((conn) => {
          const platformsOfProvider = PLATFORMS.filter((p) => p.provider === conn.provider);
          return (
            <div key={conn.provider} className="rounded-lg border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{platformsOfProvider.map((p) => p.icon).join("")}</span>
                  <div>
                    <h2 className="font-display text-base font-semibold">{conn.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {platformsOfProvider.map((p) => p.label).join(" · ")}
                    </p>
                  </div>
                </div>
                {conn.connected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5" /> Verbunden
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <XCircle className="size-3.5" /> Nicht verbunden
                  </span>
                )}
              </div>

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Umgebungsvariablen</p>
              <ul className="space-y-1.5">
                {[...conn.configured, ...conn.missing].sort().map((v) => {
                  const ok = conn.configured.includes(v);
                  return (
                    <li key={v} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                      <code className="text-xs">{v}</code>
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> gesetzt</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="size-3.5" /> fehlt</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {conn.connected ? (
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <TestConnectionButton provider={conn.provider} />
                  <span className="text-xs text-muted-foreground">Prüft die Zugangsdaten mit einem echten API-Aufruf.</span>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Trage die fehlenden Variablen in Vercel (Project → Settings → Environment Variables) ein und
                  deploye neu. Danach wird diese Plattform automatisch als verbunden erkannt.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
