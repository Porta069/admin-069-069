"use client";

import * as React from "react";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatEuroCents } from "@/lib/format";
import { Combobox } from "./combobox";
import { createInvoice } from "../actions";

export interface PlacementOption {
  id: string;
  label: string;
  hint: string;
  baseFeeCents: number;
  commissionCents: number;
}

export function CreateInvoiceDialog({
  placements,
}: {
  placements: PlacementOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [placementId, setPlacementId] = React.useState<string | null>(null);

  const selected = placements.find((p) => p.id === placementId);
  const total = selected
    ? selected.baseFeeCents + selected.commissionCents
    : 0;

  const submit = () => {
    if (!placementId) {
      toast.error("Bitte eine Vermittlung auswählen.");
      return;
    }
    startTransition(async () => {
      const result = await createInvoice(placementId);
      if (result.ok) {
        toast.success(result.message ?? "Rechnung wurde erstellt.");
        setPlacementId(null);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FilePlus2 className="size-4" />
          Rechnung erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rechnung aus Vermittlung erstellen</DialogTitle>
          <DialogDescription>
            Vermittlung ohne offene Rechnung wählen. Nummer, Beträge und
            Zahlungsziel (14 Tage) werden automatisch gesetzt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vermittlung *</Label>
            <Combobox
              options={placements.map((p) => ({
                value: p.id,
                label: p.label,
                hint: p.hint,
              }))}
              value={placementId}
              onChange={setPlacementId}
              placeholder="Vermittlung auswählen…"
              emptyText="Keine offene Vermittlung ohne Rechnung."
            />
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Grundgebühr</span>
                <span className="tabular">
                  {formatEuroCents(selected.baseFeeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Erfolgsprovision</span>
                <span className="tabular">
                  {formatEuroCents(selected.commissionCents)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2 font-medium">
                <span>Rechnungsbetrag</span>
                <span className="tabular">{formatEuroCents(total)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || !placementId}>
            {pending ? "Erstellt…" : "Rechnung erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
