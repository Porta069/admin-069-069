"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Loader2, ShieldCheck } from "lucide-react";
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
  provisionPercent,
  canEdit,
}: {
  baseFeeCents: number;
  maxCommissionCents: number;
  referralRewardCents: number;
  provisionPercent: number;
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
  const [provision, setProvision] = React.useState(
    String(provisionPercent).replace(".", ","),
  );
  const [totpCode, setTotpCode] = React.useState("");

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
    const percent = Number(provision.replace(",", "."));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error("Bitte einen Prozentsatz zwischen 0 und 100 angeben.");
      return;
    }
    if (!/^\d{6}$/.test(totpCode.trim())) {
      toast.error("Bitte den 6-stelligen 2FA-Code aus deiner App eingeben.");
      return;
    }
    setPending(true);
    const result = await savePricing({
      baseFeeCents: base,
      maxCommissionCents: commission,
      referralRewardCents: reward,
      provisionPercent: percent,
      totpCode: totpCode.trim(),
    });
    setPending(false);
    if (result.ok) {
      toast.success("Vergütung wurde gespeichert");
      setTotpCode("");
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pricing-provision">Erfolgsprovision (% vom Jahresgehalt)</Label>
          <div className="relative">
            <Input
              id="pricing-provision"
              value={provision}
              onChange={(e) => setProvision(e.target.value)}
              disabled={!canEdit}
              inputMode="decimal"
              className="pr-8 text-right tabular"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Standardsatz für die Rechnungs-Berechnung aus dem Brutto-Jahresgehalt.
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">Sicherheitsbestätigung erforderlich</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Bezahl-Variablen sind sensibel — bitte den aktuellen 2FA-Code aus deiner Authenticator-App eingeben.
              </p>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-stelliger Code"
                className="mt-2 w-40 tabular"
                aria-label="2FA-Code"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Wirkt auf neue Vermittlungen — bestehende bleiben unverändert.
        </p>
        {canEdit && (
          <Button type="submit" disabled={pending || totpCode.length !== 6}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        )}
      </div>
    </form>
  );
}
