import Link from "next/link";
import { PlugZap } from "lucide-react";
import type { ConnStatus } from "@/lib/ads/connection";

/** Ehrlicher „Noch nicht verbunden“-Hinweis (Server-Komponente, keine Secrets). */
export function ConnectionBanner({ connections }: { connections: ConnStatus[] }) {
  const offen = connections.filter((c) => !c.connected);
  if (offen.length === 0) return null;
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft/40 p-4">
      <PlugZap className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-warning">Noch nicht verbunden</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {offen.map((c) => c.label).join(" · ")} {offen.length === 1 ? "ist" : "sind"} noch nicht angebunden.
          Die Oberfläche ist vollständig vorbereitet — Kampagnen lassen sich als Entwurf anlegen. Echte Schaltung
          und Kennzahlen sind erst nach Hinterlegen der Zugangsdaten aktiv.
        </p>
        <Link href="/werbung/verbindungen" className="mt-1.5 inline-block text-sm font-medium text-primary hover:underline">
          Zu den Verbindungen →
        </Link>
      </div>
    </div>
  );
}
