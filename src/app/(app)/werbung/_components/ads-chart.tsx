"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatEuroCents, formatNumber } from "@/lib/format";

export interface ChartPunkt {
  datum: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  registrations: number;
  cpaCents: number | null;
}

type Metrik = "spend" | "impressions" | "clicks" | "registrations" | "cpa";

const METRIKEN: { key: Metrik; label: string }[] = [
  { key: "spend", label: "Ausgaben" },
  { key: "impressions", label: "Impressionen" },
  { key: "clicks", label: "Klicks" },
  { key: "registrations", label: "Registrierungen" },
  { key: "cpa", label: "CPA" },
];

function wert(p: ChartPunkt, m: Metrik): number {
  switch (m) {
    case "spend": return p.spendCents;
    case "impressions": return p.impressions;
    case "clicks": return p.clicks;
    case "registrations": return p.registrations;
    case "cpa": return p.cpaCents ?? 0;
  }
}

function label(v: number, m: Metrik): string {
  return m === "spend" || m === "cpa" ? formatEuroCents(v) : formatNumber(v);
}

export function AdsChart({ serie }: { serie: ChartPunkt[] }) {
  const [metrik, setMetrik] = React.useState<Metrik>("spend");
  const max = Math.max(1, ...serie.map((p) => wert(p, metrik)));

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex flex-wrap gap-1">
          {METRIKEN.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetrik(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metrik === m.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {serie.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium">Noch keine Daten</p>
          <p className="text-xs text-muted-foreground">
            Sobald eine Plattform verbunden und synchronisiert ist, erscheinen hier echte Werte.
          </p>
        </div>
      ) : (
        <div className="flex h-52 items-end gap-1">
          {serie.map((p) => {
            const v = wert(p, metrik);
            const h = Math.round((v / max) * 100);
            return (
              <div key={p.datum} className="group relative flex flex-1 flex-col items-center justify-end">
                <div
                  className="w-full rounded-t bg-primary/80 transition-all group-hover:bg-primary"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-sm group-hover:block">
                  <span className="font-medium">{label(v, metrik)}</span>
                  <span className="block text-[10px] text-muted-foreground">{p.datum}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
