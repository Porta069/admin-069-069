"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban, CheckCircle2, CreditCard, FileText, Landmark, Loader2, MoreHorizontal, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatEuroCents } from "@/lib/format";
import {
  approvePayout, setPayoutBankData, settlePayoutAction, cancelPayout,
} from "../actions";

export interface PayoutActionData {
  id: string;
  art: string;
  status: string;
  recipientName: string;
  amountCents: number;
  recipientEmail: string | null;
  bankHolder: string | null;
  bankIban: string | null;
  bankBic: string | null;
  method: string | null;
  invoiceId: string | null;
}

export function PayoutRowActions({ p }: { p: PayoutActionData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<"bank" | "pay" | null>(null);
  const [sendEmail, setSendEmail] = React.useState(true);
  const [bank, setBank] = React.useState({
    holder: p.bankHolder ?? "", iban: p.bankIban ?? "", bic: p.bankBic ?? "",
    method: p.method ?? "UEBERWEISUNG", email: p.recipientEmail ?? "",
  });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, close = true) =>
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) { toast.success(r.message ?? "Erledigt.", { duration: 6000 }); if (close) setDialog(null); router.refresh(); }
      else toast.error(r.message ?? "Fehlgeschlagen.", { duration: 8000 });
    });

  const offen = p.status === "OFFEN";
  const genehmigt = p.status === "GENEHMIGT";
  const zahlbar = offen || genehmigt;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialog("bank")}>
            <Landmark className="size-4" /> Zahlungsdaten
          </DropdownMenuItem>
          {offen && (
            <DropdownMenuItem onClick={() => run(() => approvePayout(p.id))}>
              <CheckCircle2 className="size-4" /> Genehmigen
            </DropdownMenuItem>
          )}
          {zahlbar && (
            <DropdownMenuItem onClick={() => setDialog("pay")}>
              <Wallet className="size-4" /> Auszahlen
            </DropdownMenuItem>
          )}
          {p.invoiceId && (
            <DropdownMenuItem onClick={() => router.push(`/finanzen/${p.invoiceId}`)}>
              <FileText className="size-4" /> Beleg ansehen
            </DropdownMenuItem>
          )}
          {p.status !== "AUSGEZAHLT" && p.status !== "STORNIERT" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { if (confirm("Auszahlung stornieren?")) run(() => cancelPayout(p.id)); }}
              >
                <Ban className="size-4" /> Stornieren
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Zahlungsdaten */}
      <Dialog open={dialog === "bank"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zahlungsdaten — {p.recipientName}</DialogTitle>
            <DialogDescription>Für die Überweisung und die Auszahlungs-E-Mail.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Kontoinhaber</Label>
              <Input value={bank.holder} onChange={(e) => setBank((s) => ({ ...s, holder: e.target.value }))} placeholder={p.recipientName} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label>IBAN</Label>
                <Input value={bank.iban} onChange={(e) => setBank((s) => ({ ...s, iban: e.target.value }))} placeholder="DE.." />
              </div>
              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input value={bank.bic} onChange={(e) => setBank((s) => ({ ...s, bic: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Methode</Label>
                <Select value={bank.method} onValueChange={(v) => setBank((s) => ({ ...s, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UEBERWEISUNG">Überweisung</SelectItem>
                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                    <SelectItem value="SONSTIGE">Sonstige</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail (für Beleg)</Label>
                <Input type="email" value={bank.email} onChange={(e) => setBank((s) => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button disabled={pending} onClick={() => run(() => setPayoutBankData(p.id, bank))}>
              {pending && <Loader2 className="size-4 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auszahlen */}
      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auszahlen — {formatEuroCents(p.amountCents)}</DialogTitle>
            <DialogDescription>
              An {p.recipientName}. Es wird automatisch ein Beleg erzeugt
              {p.art === "REFERRAL" ? " und die Prämie im Backend als bezahlt markiert" : ""}.
            </DialogDescription>
          </DialogHeader>
          {!p.bankIban && (
            <p className="rounded-lg border border-warning/40 bg-warning-soft/40 p-2.5 text-xs text-warning">
              Keine IBAN hinterlegt — du kannst trotzdem auszahlen (Überweisung manuell), aber trage die Bankdaten am besten zuerst ein.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Bestätigungs-E-Mail an {p.recipientEmail || bank.email || "den Empfänger"} senden
          </label>
          {!p.recipientEmail && !bank.email && sendEmail && (
            <p className="text-xs text-muted-foreground">Keine E-Mail-Adresse hinterlegt — dann wird keine Mail versendet.</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button disabled={pending} onClick={() => run(() => settlePayoutAction(p.id, sendEmail))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Jetzt auszahlen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
