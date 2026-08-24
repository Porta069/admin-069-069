"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { kandidatZusammenfassung } from "../summary-actions";

export function KiSummaryButton({ applicationId }: { applicationId: string }) {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ stand: string; naechsterSchritt: string } | null>(null);

  const laden = async () => {
    setPending(true);
    const res = await kandidatZusammenfassung(applicationId);
    setPending(false);
    if (res.ok) setResult({ stand: res.stand, naechsterSchritt: res.naechsterSchritt });
    else toast.error(res.message);
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" className="bg-card" onClick={laden} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-primary" />}
        {result ? "Neu zusammenfassen" : "KI-Zusammenfassung"}
      </Button>

      {result && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="text-foreground">{result.stand}</p>
          <p className="mt-2 flex items-start gap-1.5 font-medium text-primary">
            <ArrowRight className="mt-0.5 size-4 shrink-0" />
            {result.naechsterSchritt}
          </p>
        </div>
      )}
    </div>
  );
}
