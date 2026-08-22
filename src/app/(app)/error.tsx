"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Ohne Roh-Fehlertext an den Nutzer — nur intern.
    console.error("segment error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-lg font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Diese Ansicht konnte nicht geladen werden. Versuch es erneut — wenn es
          bestehen bleibt, lade die Seite neu.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
            Ref: {error.digest}
          </p>
        )}
      </div>
      <Button size="sm" onClick={reset}>
        <RotateCcw className="size-4" /> Erneut versuchen
      </Button>
    </div>
  );
}
