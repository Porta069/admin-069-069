"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRAESENZ_WAHL, PRAESENZ_META, type EffektivePraesenz } from "@/lib/presence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";

/**
 * Manueller Präsenz-Umschalter im Kopf: Verfügbar / Abwesend / Im Urlaub.
 * „Im Call" wird automatisch von der Telefonzentrale gesetzt und hier nur angezeigt.
 */
export function PresenceSwitcher({
  initialPresence,
  initialEffektiv,
}: {
  initialPresence: string;
  initialEffektiv: EffektivePraesenz;
}) {
  const router = useRouter();
  const [presence, setPresence] = React.useState(initialPresence);
  const [eff, setEff] = React.useState<EffektivePraesenz>(initialEffektiv);
  const [pending, setPending] = React.useState(false);
  const meta = PRAESENZ_META[eff];

  const setzen = async (status: string) => {
    setPending(true);
    try {
      const res = await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setPresence(data.presence);
        setEff(data.effektiv);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          aria-label="Präsenz-Status ändern"
        >
          <span className={cn("size-2 rounded-full", meta.dot)} />
          <span className="hidden sm:inline">{meta.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {PRAESENZ_WAHL.map((w) => (
          <DropdownMenuItem
            key={w.key}
            onClick={() => setzen(w.key)}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                w.key === "AVAILABLE"
                  ? "bg-success"
                  : w.key === "ABWESEND"
                    ? "bg-warning"
                    : "bg-muted-foreground/50",
              )}
            />
            {w.label}
            {presence === w.key && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
