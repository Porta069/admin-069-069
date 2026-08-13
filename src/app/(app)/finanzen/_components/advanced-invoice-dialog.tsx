"use client";

import * as React from "react";
import { toast } from "sonner";
import { FilePlus, Plus, Trash2 } from "lucide-react";
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
import { Combobox } from "./combobox";
import { createManualInvoice, createReferralInvoice } from "../actions";

export interface ReferralOption {
  id: string;
  label: string;
  hint: string;
}
export interface CompanyOption {
  value: string;
  label: string;
}

interface Position {
  bezeichnung: string;
  menge: string;
  einzelpreis: string; // Euro-Eingabe
}

const LEER_POSITION: Position = { bezeichnung: "", menge: "1", einzelpreis: "" };

export function AdvancedInvoiceDialog({
  referrals,
  companies,
}: {
  referrals: ReferralOption[];
  companies: CompanyOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [modus, setModus] = React.useState<"MANUELL" | "REFERRAL">("MANUELL");

  // Empfehlung
  const [referralId, setReferralId] = React.useState<string | null>(null);

  // Manuell / Premium
  const [art, setArt] = React.useState("PREMIUM");
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [recipientName, setRecipientName] = React.useState("");
  const [recipientAddress, setRecipientAddress] = React.useState("");
  const [taxRate, setTaxRate] = React.useState("0");
  const [dueDays, setDueDays] = React.useState("14");
  const [notes, setNotes] = React.useState("");
  const [positionen, setPositionen] = React.useState<Position[]>([
    { ...LEER_POSITION },
  ]);

  const setPos = (i: number, patch: Partial<Position>) =>
    setPositionen((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPos = () => setPositionen((prev) => [...prev, { ...LEER_POSITION }]);
  const removePos = (i: number) =>
    setPositionen((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const netto = positionen.reduce((s, p) => {
    const menge = Math.max(1, Math.round(Number(p.menge) || 1));
    const einzel = Math.round((Number(p.einzelpreis.replace(",", ".")) || 0) * 100);
    return s + menge * einzel;
  }, 0);
  const steuer = Math.round((netto * (Number(taxRate) || 0)) / 100);
  const brutto = netto + steuer;

  function reset() {
    setReferralId(null);
    setCompanyId(null);
    setRecipientName("");
    setRecipientAddress("");
    setTaxRate("0");
    setDueDays("14");
    setNotes("");
    setPositionen([{ ...LEER_POSITION }]);
  }

  const submit = () => {
    if (modus === "REFERRAL") {
      if (!referralId) {
        toast.error("Bitte eine Empfehlung auswählen.");
        return;
      }
      startTransition(async () => {
        const res = await createReferralInvoice(referralId);
        if (res.ok) {
          toast.success(res.message ?? "Abrechnung erstellt.");
          reset();
          setOpen(false);
        } else toast.error(res.message);
      });
      return;
    }

    if (!recipientName.trim()) {
      toast.error("Bitte einen Rechnungsempfänger angeben.");
      return;
    }
    const posPayload = positionen
      .map((p) => ({
        bezeichnung: p.bezeichnung.trim(),
        menge: Math.max(1, Math.round(Number(p.menge) || 1)),
        einzelpreisCents: Math.round((Number(p.einzelpreis.replace(",", ".")) || 0) * 100),
      }))
      .filter((p) => p.bezeichnung && p.einzelpreisCents > 0);
    if (posPayload.length === 0) {
      toast.error("Bitte mindestens eine Position mit Betrag erfassen.");
      return;
    }
    startTransition(async () => {
      const res = await createManualInvoice({
        art,
        companyId,
        recipientName,
        recipientAddress,
        taxRate: Number(taxRate) || 0,
        dueDays: Number(dueDays) || 14,
        notes,
        positionen: posPayload,
      });
      if (res.ok) {
        toast.success(res.message ?? "Rechnung erstellt.");
        reset();
        setOpen(false);
      } else toast.error(res.message);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-card">
          <FilePlus className="size-4" />
          Weitere Rechnung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rechnung / Abrechnung erstellen</DialogTitle>
          <DialogDescription>
            Premium-Account, Empfehlungsabrechnung oder ein sonstiger Beleg — mit
            frei erfassbaren Positionen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Belegtyp</Label>
            <Select value={modus} onValueChange={(v) => setModus(v as typeof modus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUELL">Premium / Manuell</SelectItem>
                <SelectItem value="REFERRAL">Empfehlungsabrechnung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modus === "REFERRAL" ? (
            <div className="space-y-1.5">
              <Label>Empfehlungs-Vorgang *</Label>
              <Combobox
                options={referrals.map((r) => ({
                  value: r.id,
                  label: r.label,
                  hint: r.hint,
                }))}
                value={referralId}
                onChange={setReferralId}
                placeholder="Empfehlung auswählen…"
                emptyText="Keine offene Empfehlung ohne Abrechnung."
              />
              <p className="text-xs text-muted-foreground">
                Erstellt eine Abrechnung der Empfehlungsprämie an den werbenden
                Partner.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Art</Label>
                  <Select value={art} onValueChange={setArt}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREMIUM">Premium-Account</SelectItem>
                      <SelectItem value="VERMITTLUNG">Vermittlung</SelectItem>
                      <SelectItem value="SONSTIGE">Sonstige</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unternehmen (optional)</Label>
                  <Combobox
                    options={companies}
                    value={companyId}
                    onChange={(v) => {
                      setCompanyId(v);
                      const c = companies.find((x) => x.value === v);
                      if (c && !recipientName.trim()) setRecipientName(c.label);
                    }}
                    placeholder="Verknüpfen…"
                    emptyText="Kein Unternehmen."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recipient">Rechnungsempfänger *</Label>
                <Input
                  id="recipient"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Name / Firma"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse (optional)</Label>
                <Textarea
                  id="address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  rows={2}
                  placeholder="Straße, PLZ Ort"
                />
              </div>

              <div className="space-y-2">
                <Label>Positionen</Label>
                {positionen.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Input
                      value={p.bezeichnung}
                      onChange={(e) => setPos(i, { bezeichnung: e.target.value })}
                      placeholder="Bezeichnung"
                      className="flex-1"
                    />
                    <Input
                      value={p.menge}
                      onChange={(e) => setPos(i, { menge: e.target.value })}
                      inputMode="numeric"
                      className="w-14"
                      aria-label="Menge"
                    />
                    <Input
                      value={p.einzelpreis}
                      onChange={(e) => setPos(i, { einzelpreis: e.target.value })}
                      inputMode="decimal"
                      placeholder="€"
                      className="w-24"
                      aria-label="Einzelpreis in Euro"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePos(i)}
                      disabled={positionen.length === 1}
                      className="shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPos}>
                  <Plus className="size-4" />
                  Position hinzufügen
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tax">USt (%)</Label>
                  <Input
                    id="tax"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due">Zahlungsziel (Tage)</Label>
                  <Input
                    id="due"
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Hinweise (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1 rounded-lg border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Netto</span>
                  <span className="tabular">{formatEuroCents(netto)}</span>
                </div>
                {Number(taxRate) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      zzgl. {Number(taxRate)}% USt
                    </span>
                    <span className="tabular">{formatEuroCents(steuer)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Gesamtbetrag</span>
                  <span className="tabular">{formatEuroCents(brutto)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Erstellt…" : "Rechnung erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
