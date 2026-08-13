"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBankTransaction } from "../actions";

export interface AccountOption {
  id: string;
  name: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateTransactionDialog({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [accountId, setAccountId] = React.useState<string>(
    accounts[0]?.id ?? "",
  );
  const [bookedAt, setBookedAt] = React.useState(todayISO());
  const [amount, setAmount] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [counterparty, setCounterparty] = React.useState("");

  const disabled = accounts.length === 0;

  const submit = () => {
    if (!accountId) {
      toast.error("Bitte ein Konto auswählen.");
      return;
    }
    const normalized = amount.replace(/\./g, "").replace(",", ".");
    const euros = Number(normalized);
    if (!Number.isFinite(euros) || euros === 0) {
      toast.error("Bitte einen Betrag ungleich 0 angeben.");
      return;
    }
    const amountCents = Math.round(euros * 100);

    startTransition(async () => {
      const result = await createBankTransaction({
        accountId,
        bookedAt,
        amountCents,
        purpose,
        counterpartyName: counterparty,
      });
      if (result.ok) {
        toast.success(result.message ?? "Buchung erfasst.");
        setAmount("");
        setPurpose("");
        setCounterparty("");
        setBookedAt(todayISO());
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Plus className="size-4" />
          Buchung erfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kontobewegung erfassen</DialogTitle>
          <DialogDescription>
            Manuelle Testbuchung, solange CSV-Import und Bank-Sync noch folgen.
            Positiver Betrag = Zahlungseingang, negativer Betrag = Ausgang.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Konto *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Konto auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Buchungsdatum *</Label>
              <Input
                id="tx-date"
                type="date"
                value={bookedAt}
                onChange={(e) => setBookedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Betrag (EUR) *</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.234,56"
                className="text-right tabular"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-purpose">Verwendungszweck</Label>
            <Input
              id="tx-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="z. B. RE-2026-42 Zahlung"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-counterparty">Gegenpartei</Label>
            <Input
              id="tx-counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Name des Absenders"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Wird gespeichert…" : "Buchung speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
