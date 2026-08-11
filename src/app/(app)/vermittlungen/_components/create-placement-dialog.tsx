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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuroCents } from "@/lib/format";
import { Combobox, type ComboOption } from "./combobox";
import { createPlacement } from "../actions";

export interface JobOption {
  id: string;
  title: string;
  companyId: string;
}

const NO_JOB = "__none__";

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "2.500,00" | "2500,5" | "2500" → Cents (oder null bei Unsinn). */
function parseEuroInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function CreatePlacementDialog({
  candidates,
  companies,
  jobs,
  baseFeeCents,
  maxCommissionCents,
}: {
  candidates: ComboOption[];
  companies: ComboOption[];
  jobs: JobOption[];
  baseFeeCents: number;
  maxCommissionCents: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [applicationId, setApplicationId] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [jobId, setJobId] = React.useState<string>(NO_JOB);
  const [baseFee, setBaseFee] = React.useState(centsToInput(baseFeeCents));
  const [commission, setCommission] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const companyJobs = jobs.filter((j) => j.companyId === companyId);

  const reset = () => {
    setApplicationId(null);
    setCompanyId(null);
    setJobId(NO_JOB);
    setBaseFee(centsToInput(baseFeeCents));
    setCommission("");
    setNotes("");
  };

  const submit = () => {
    if (!applicationId || !companyId) {
      toast.error("Bitte Kandidat und Unternehmen auswählen.");
      return;
    }
    const baseFeeParsed = parseEuroInput(baseFee);
    if (baseFeeParsed === null) {
      toast.error("Bitte eine gültige Grundgebühr angeben.");
      return;
    }
    const commissionParsed =
      commission.trim() === "" ? 0 : parseEuroInput(commission);
    if (commissionParsed === null) {
      toast.error("Bitte eine gültige Provision angeben.");
      return;
    }
    if (commissionParsed > maxCommissionCents) {
      toast.error(
        `Die Provision darf maximal ${formatEuroCents(maxCommissionCents)} betragen.`,
      );
      return;
    }

    startTransition(async () => {
      const result = await createPlacement({
        applicationId,
        companyId,
        jobPostingId: jobId === NO_JOB ? null : jobId,
        baseFeeCents: baseFeeParsed,
        commissionCents: commissionParsed,
        notes: notes || null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Vermittlung wurde erfasst.");
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
          Vermittlung erfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vermittlung erfassen</DialogTitle>
          <DialogDescription>
            Kandidat, Unternehmen und Konditionen der erfolgreichen Vermittlung
            festhalten.
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
            <Label>Unternehmen *</Label>
            <Combobox
              options={companies}
              value={companyId}
              onChange={(value) => {
                setCompanyId(value);
                setJobId(NO_JOB);
              }}
              placeholder="Unternehmen auswählen…"
              emptyText="Kein Unternehmen gefunden."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Stelle (optional)</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={!companyId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    companyId
                      ? "Stelle des Unternehmens wählen…"
                      : "Zuerst Unternehmen wählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_JOB}>Ohne konkrete Stelle</SelectItem>
                {companyJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companyId && companyJobs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Für dieses Unternehmen sind keine Stellen hinterlegt.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw-base-fee">Grundgebühr (€)</Label>
              <Input
                id="pw-base-fee"
                inputMode="decimal"
                value={baseFee}
                onChange={(e) => setBaseFee(e.target.value)}
                className="tabular"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-commission">Provision (€)</Label>
              <Input
                id="pw-commission"
                inputMode="decimal"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0,00"
                className="tabular"
              />
              <p className="text-xs text-muted-foreground">
                max. {formatEuroCents(maxCommissionCents)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pw-notes">Notiz (optional)</Label>
            <Textarea
              id="pw-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="z. B. Startdatum, Absprachen…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Speichert…" : "Vermittlung speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
