"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { saveRadarSettings } from "../actions";

export function RadarSettingsDialog({
  schwelle,
  topN,
}: {
  schwelle: number;
  topN: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [schwelleValue, setSchwelleValue] = React.useState(String(schwelle));
  const [topNValue, setTopNValue] = React.useState(String(topN));

  const reset = () => {
    setSchwelleValue(String(schwelle));
    setTopNValue(String(topN));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const result = await saveRadarSettings({
      schwelle: Number(schwelleValue),
      topN: Number(topNValue),
    });
    setPending(false);
    if (result.ok) {
      toast.success("Radar-Einstellungen gespeichert");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 bg-card">
          <SlidersHorizontal className="size-4" />
          Einstellungen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Radar-Einstellungen</DialogTitle>
            <DialogDescription>
              Steuert, ab welchem Match-Score und wie viele Top-Treffer der
              Sync-Runner je Kandidat/Stelle als Vorschlag erfasst.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="radar-schwelle">Score-Schwelle (%)</Label>
            <Input
              id="radar-schwelle"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={schwelleValue}
              onChange={(e) => setSchwelleValue(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Nur Matches ab diesem Score werden automatisch erfasst.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="radar-topn">Top-N je Kandidat / Stelle</Label>
            <Input
              id="radar-topn"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={topNValue}
              onChange={(e) => setTopNValue(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Höchstzahl der besten Treffer, die je Lauf angelegt werden.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
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
