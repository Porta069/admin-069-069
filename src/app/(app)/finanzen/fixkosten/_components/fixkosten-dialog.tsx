"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Upload, FileText } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatEuroCents } from "@/lib/format";
import {
  proMonatCents,
  proJahrCents,
  type FixKind,
  type FixIntervall,
} from "@/lib/fixkosten-berechnung";
import { createFixedCost } from "../actions";

function parseEuroLive(s: string): number {
  const c = s.trim().replace(/\s|€/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(c);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export function FixkostenDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [kind, setKind] = React.useState<FixKind>("LAUFEND");
  const [intervall, setIntervall] = React.useState<FixIntervall>("MONTHLY");
  const [betrag, setBetrag] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const cents = parseEuroLive(betrag);
  const item = { kind, intervall: kind === "LAUFEND" ? intervall : null, amountCents: cents };
  const proMonat = proMonatCents(item);
  const proJahr = proJahrCents(item);

  const reset = () => {
    setKind("LAUFEND");
    setIntervall("MONTHLY");
    setBetrag("");
    setFile(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Fixkosten erfassen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fixkosten erfassen</DialogTitle>
          <DialogDescription>
            Laufende Kosten oder Einmalzahlung — wird automatisch auf Monat und
            Jahr umgerechnet.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => {
            fd.set("kind", kind);
            fd.set("intervall", kind === "LAUFEND" ? intervall : "");
            setPending(true);
            createFixedCost(fd)
              .then((res) => {
                if (res.ok) {
                  toast.success("Fixkosten gespeichert.");
                  setOpen(false);
                  reset();
                  router.refresh();
                } else toast.error(res.message);
              })
              .finally(() => setPending(false));
          }}
          className="space-y-4"
        >
          {/* Typ-Umschalter */}
          <div className="grid grid-cols-2 gap-2">
            <TypeButton
              active={kind === "LAUFEND"}
              onClick={() => setKind("LAUFEND")}
              title="Laufend"
              sub="wiederkehrend"
            />
            <TypeButton
              active={kind === "EINMALIG"}
              onClick={() => setKind("EINMALIG")}
              title="Einmalzahlung"
              sub="einmalig"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input id="bezeichnung" name="bezeichnung" required placeholder="z. B. Büromiete, Software-Lizenz" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="betrag">Betrag (€)</Label>
              <Input
                id="betrag"
                name="betrag"
                inputMode="decimal"
                required
                placeholder="0,00"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
              />
            </div>
            {kind === "LAUFEND" ? (
              <div className="space-y-1.5">
                <Label>Intervall</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <IntervalButton active={intervall === "MONTHLY"} onClick={() => setIntervall("MONTHLY")}>
                    Monatlich
                  </IntervalButton>
                  <IntervalButton active={intervall === "YEARLY"} onClick={() => setIntervall("YEARLY")}>
                    Jährlich
                  </IntervalButton>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="faellig_on">Datum</Label>
                <Input id="faellig_on" name="faellig_on" type="date" />
              </div>
            )}
          </div>

          {/* Live-Umrechnung */}
          {cents > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pro Monat
                </p>
                <p className="font-display text-lg font-semibold tabular">
                  {formatEuroCents(proMonat)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Pro Jahr
                </p>
                <p className="font-display text-lg font-semibold tabular">
                  {formatEuroCents(proJahr)}
                </p>
              </div>
              {kind === "EINMALIG" && (
                <p className="col-span-2 text-[11px] text-muted-foreground">
                  Einmalzahlung — pro Monat anteilig (÷ 12) gerechnet.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="kategorie">Kategorie (optional)</Label>
              <Input id="kategorie" name="kategorie" placeholder="z. B. Miete, IT, Marketing" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beleg">Rechnung / Beleg (optional)</Label>
              <label
                htmlFor="beleg"
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-muted",
                  file && "text-foreground",
                )}
              >
                {file ? <FileText className="size-4 shrink-0" /> : <Upload className="size-4 shrink-0" />}
                <span className="truncate">{file ? file.name : "PDF / Bild wählen"}</span>
              </label>
              <input
                id="beleg"
                name="beleg"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notiz">Notiz (optional)</Label>
            <Input id="notiz" name="notiz" placeholder="Interne Notiz" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeButton({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-2.5 text-left transition-colors",
        active ? "border-primary bg-primary/8 ring-1 ring-primary/30" : "hover:bg-muted",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </button>
  );
}

function IntervalButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md border text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
