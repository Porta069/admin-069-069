"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ArrowRight, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/empty-state";
import { formatEuroCents } from "@/lib/format";
import {
  abgleichVorschlaege,
  zuordnenBestaetigen,
  type MatchSuggestion,
} from "../actions";

export function MatchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, startLoading] = React.useTransition();
  const [confirming, startConfirming] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<MatchSuggestion[] | null>(
    null,
  );

  const openAndLoad = () => {
    setOpen(true);
    setSuggestions(null);
    startLoading(async () => {
      const result = await abgleichVorschlaege();
      if (result.ok) {
        setSuggestions(result.suggestions);
      } else {
        toast.error(result.message);
        setSuggestions([]);
      }
    });
  };

  const confirm = (s: MatchSuggestion) => {
    setBusyId(s.transactionId);
    startConfirming(async () => {
      const result = await zuordnenBestaetigen(s.transactionId, s.invoiceId);
      if (result.ok) {
        toast.success(result.message ?? "Zugeordnet.");
        setSuggestions((prev) =>
          (prev ?? []).filter((x) => x.transactionId !== s.transactionId),
        );
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setBusyId(null);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={openAndLoad}>
        <Sparkles className="size-4" />
        Zahlungseingänge zuordnen
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Zahlungseingänge zuordnen</DialogTitle>
          <DialogDescription>
            Vorschläge aus dem automatischen Abgleich offener Rechnungen mit nicht
            zugeordneten Zahlungseingängen. Beim Bestätigen wird die Rechnung als
            bezahlt markiert.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Vorschläge werden ermittelt…
          </div>
        ) : suggestions && suggestions.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {suggestions.map((s) => {
              const busy = confirming && busyId === s.transactionId;
              return (
                <li
                  key={s.transactionId}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5 text-sm">
                    <span className="tabular font-medium text-success">
                      {formatEuroCents(s.betrag)}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <span className="font-mono font-medium">{s.nummer}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.grund === "nummer"
                          ? "Zweck enthält Nummer"
                          : "Betrag stimmt"}
                      </span>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => confirm(s)}
                    disabled={confirming}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCheck className="size-4" />
                    )}
                    Zuordnen
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Keine passenden Zahlungseingänge"
            description="Aktuell gibt es keine nicht zugeordneten Eingänge, die zu einer offenen Rechnung passen."
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
