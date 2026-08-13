"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
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
import { createBankAccount } from "../actions";

export function CreateAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState({
    name: "",
    bankName: "",
    iban: "",
    bic: "",
  });

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Bitte einen Kontonamen angeben.");
      return;
    }
    startTransition(async () => {
      const result = await createBankAccount(form);
      if (result.ok) {
        toast.success(result.message ?? "Konto angelegt.");
        setForm({ name: "", bankName: "", iban: "", bic: "" });
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
        <Button size="sm">
          <Landmark className="size-4" />
          Konto hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bankkonto hinzufügen</DialogTitle>
          <DialogDescription>
            Das Konto wird mit Status „Vorbereitet“ angelegt. Die automatische
            Synchronisierung mit der Bank folgt später.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Kontoname *</Label>
            <Input
              id="acc-name"
              value={form.name}
              onChange={update("name")}
              placeholder="z. B. Geschäftskonto"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-bank">Bank</Label>
            <Input
              id="acc-bank"
              value={form.bankName}
              onChange={update("bankName")}
              placeholder="z. B. Sparkasse"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="acc-iban">IBAN *</Label>
              <Input
                id="acc-iban"
                value={form.iban}
                onChange={update("iban")}
                placeholder="DE00 0000 0000 0000 0000 00"
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-bic">BIC</Label>
              <Input
                id="acc-bic"
                value={form.bic}
                onChange={update("bic")}
                placeholder="XXXXDEXX"
                autoComplete="off"
                className="font-mono sm:w-40"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Wird angelegt…" : "Konto anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
