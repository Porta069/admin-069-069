"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Combobox, type ComboOption } from "./combobox";
import { createProposal } from "../actions";

export function CreateProposalDialog({
  candidates,
  jobs,
}: {
  candidates: ComboOption[];
  jobs: ComboOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);

  const reset = () => {
    setApplicationId(null);
    setJobId(null);
  };

  const submit = () => {
    if (!applicationId || !jobId) {
      toast.error("Bitte Kandidat und Stelle auswählen.");
      return;
    }
    startTransition(async () => {
      const result = await createProposal({
        applicationId,
        jobPostingId: jobId,
      });
      if (result.ok) {
        toast.success(result.message ?? "Vorschlag wurde erstellt.");
        reset();
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
          <Plus className="size-4" />
          Vorschlag erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorschlag erstellen</DialogTitle>
          <DialogDescription>
            Kandidat und Stelle wählen. Der Match-Score wird automatisch über die
            Matching-Engine ermittelt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kandidat *</Label>
            <Combobox
              options={candidates}
              value={applicationId}
              onChange={setApplicationId}
              placeholder="Kandidat auswählen…"
              emptyText="Kein Kandidat gefunden."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stelle *</Label>
            <Combobox
              options={jobs}
              value={jobId}
              onChange={setJobId}
              placeholder="Stelle auswählen…"
              emptyText="Keine Stelle gefunden."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Der Vorschlag startet im Status „Vorgeschlagen" und durchläuft dann den
            Angebots-Workflow.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Erstellt…" : "Vorschlag erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
