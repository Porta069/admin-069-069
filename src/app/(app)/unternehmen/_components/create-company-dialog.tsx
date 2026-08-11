"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2, Plus } from "lucide-react";
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
import type { ActionResult, CreateCompanyPayload } from "../actions";

const EMPTY: CreateCompanyPayload = {
  name: "",
  strasse: "",
  plz: "",
  ort: "",
  kontaktName: "",
  kontaktEmail: "",
  kontaktTelefon: "",
  website: "",
};

export function CreateCompanyDialog({
  action,
  initialOpen = false,
}: {
  action: (payload: CreateCompanyPayload) => Promise<ActionResult>;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(initialOpen);
  const [form, setForm] = React.useState<CreateCompanyPayload>(EMPTY);
  const [pending, startTransition] = React.useTransition();

  const set =
    (key: keyof CreateCompanyPayload) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && initialOpen) {
      // ?neu=1 aus der URL entfernen, damit der Dialog nicht wieder aufspringt
      router.replace(pathname, { scroll: false });
    }
  };

  const submit = () =>
    startTransition(async () => {
      const result = await action(form).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Unternehmen angelegt.");
        setForm(EMPTY);
        handleOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Anlegen fehlgeschlagen.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Unternehmen anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Unternehmen anlegen
          </DialogTitle>
          <DialogDescription>
            Das Unternehmen wird über die Plattform-API erstellt und erscheint
            anschließend in der Liste.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">Firmenname *</Label>
            <Input
              id="cc-name"
              value={form.name}
              onChange={set("name")}
              placeholder="z. B. Müller Haustechnik GmbH"
            />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="cc-strasse">Straße</Label>
              <Input id="cc-strasse" value={form.strasse} onChange={set("strasse")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-plz">PLZ</Label>
              <Input id="cc-plz" value={form.plz} onChange={set("plz")} inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-ort">Ort</Label>
            <Input id="cc-ort" value={form.ort} onChange={set("ort")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cc-kontakt">Ansprechpartner</Label>
              <Input
                id="cc-kontakt"
                value={form.kontaktName}
                onChange={set("kontaktName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-telefon">Telefon</Label>
              <Input
                id="cc-telefon"
                value={form.kontaktTelefon}
                onChange={set("kontaktTelefon")}
                type="tel"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cc-email">E-Mail</Label>
              <Input
                id="cc-email"
                value={form.kontaktEmail}
                onChange={set("kontaktEmail")}
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-website">Website</Label>
              <Input
                id="cc-website"
                value={form.website}
                onChange={set("website")}
                placeholder="https://…"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || form.name.trim().length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
