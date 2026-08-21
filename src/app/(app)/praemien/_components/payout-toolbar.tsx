"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePayoutsNow, setPayoutAutomation } from "../actions";

export function GeneratePayoutsButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline" size="sm" disabled={pending}
      onClick={() => startTransition(async () => {
        const r = await generatePayoutsNow().catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
        if (r.ok) toast.success(r.message ?? "Aktualisiert.");
        else toast.error(r.message);
        router.refresh();
      })}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Auszahlungen aktualisieren
    </Button>
  );
}

export function AutomationToggle({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Zap className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Auszahlungen automatisieren</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Genehmigte Auszahlungen mit hinterlegter IBAN werden im täglichen Lauf automatisch als ausgezahlt markiert,
          inkl. Beleg und Bestätigungs-E-Mail. Die eigentliche Überweisung erfolgt weiterhin manuell/über das Bankmodul.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => startTransition(async () => {
          const next = !on;
          setOn(next);
          const r = await setPayoutAutomation(next).catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
          if (r.ok) toast.success(r.message ?? "Gespeichert.");
          else { setOn(!next); toast.error(r.message); }
          router.refresh();
        })}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
