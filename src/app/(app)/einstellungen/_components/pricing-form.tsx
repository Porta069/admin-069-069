"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { savePricing } from "../actions";

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim();
  // Deutsche Eingabe: Komma als Dezimaltrenner, Punkt als Tausendertrenner.
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function PricingForm({
  baseFeeCents,
  maxCommissionCents,
  referralRewardCents,
  canEdit,
}: {
  baseFeeCents: number;
  maxCommissionCents: number;
  referralRewardCents: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [baseFee, setBaseFee] = React.useState(centsToInput(baseFeeCents));
  const [maxCommission, setMaxCommission] = React.useState(
    centsToInput(maxCommissionCents),
  );
  const [referralReward, setReferralReward] = React.useState(
    centsToInput(referralRewardCents),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const base = inputToCents(baseFee);
    const commission = inputToCents(maxCommission);
    const reward = inputToCents(referralReward);
    if (base === null || commission === null || reward === null) {
      toast.error("Bitte gültige Beträge angeben (z. B. 49,00).");
      return;
    }
    setPending(true);
    const result = await savePricing({
      baseFeeCents: base,
      maxCommissionCents: commission,
      referralRewardCents: reward,
    });
    setPending(false);
    if (result.ok) {
      toast.success("Vergütung wurde gespeichert");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const fields = [
    {
      id: "pricing-base",
      label: "Grundgebühr",
      value: baseFee,
      set: setBaseFee,
    },
    {
      id: "pricing-commission",
      label: "Max. Erfolgsprovision",
      value: maxCommission,
      set: setMaxCommission,
    },
    {
      id: "pricing-reward",
      label: "Partner-Prämie",
      value: referralReward,
      set: setReferralReward,
    },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <div className="relative">
              <Input
                id={field.id}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                disabled={!canEdit}
                inputMode="decimal"
                className="pr-8 text-right tabular"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Wirkt auf neue Vermittlungen — bestehende bleiben unverändert.
        </p>
        {canEdit && (
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        )}
      </div>
    </form>
  );
}
