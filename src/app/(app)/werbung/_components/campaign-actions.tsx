"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy, Loader2, MoreHorizontal, Pause, Pencil, Play, Rocket, Square, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatEuroCents } from "@/lib/format";
import { platformLabel } from "@/lib/ads/platforms";
import {
  setCampaignStatus, duplicateCampaign, deleteCampaign, publishCampaign,
} from "../actions";

export interface CampaignActionData {
  id: string;
  name: string;
  status: string;
  platforms: string[];
  dailyBudgetCents: number | null;
  totalBudgetCents: number | null;
  startDate: string | null;
  endDate: string | null;
}

const HIGH_BUDGET_CENTS = 50000; // ab 500 € Gesamtbudget: Extra-Warnung

export function CampaignActions({ c }: { c: CampaignActionData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) { toast.success(r.message ?? ok); router.refresh(); }
      else toast.error(r.message ?? "Fehlgeschlagen.");
    });

  const highBudget = (c.totalBudgetCents ?? 0) >= HIGH_BUDGET_CENTS;
  const publishBlocked = highBudget && confirmText.trim().toUpperCase() !== "VERÖFFENTLICHEN";

  const doPublish = () =>
    startTransition(async () => {
      const r = await publishCampaign(c.id).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) { toast.success(r.message ?? "Veröffentlicht."); setPublishOpen(false); router.refresh(); }
      else toast.error(r.message ?? "Fehlgeschlagen.", { duration: 8000 });
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push(`/werbung/kampagnen/${c.id}`)}>
            <Pencil className="size-4" /> Anzeigen / Bearbeiten
          </DropdownMenuItem>
          {c.status === "DRAFT" && (
            <DropdownMenuItem onClick={() => setPublishOpen(true)}>
              <Rocket className="size-4" /> Veröffentlichen
            </DropdownMenuItem>
          )}
          {c.status === "ACTIVE" && (
            <DropdownMenuItem onClick={() => run(() => setCampaignStatus(c.id, "PAUSED"), "Pausiert.")}>
              <Pause className="size-4" /> Pausieren
            </DropdownMenuItem>
          )}
          {(c.status === "PAUSED" || c.status === "ENDED") && (
            <DropdownMenuItem onClick={() => run(() => setCampaignStatus(c.id, "ACTIVE"), "Aktiviert.")}>
              <Play className="size-4" /> Aktivieren
            </DropdownMenuItem>
          )}
          {c.status !== "ENDED" && c.status !== "DRAFT" && (
            <DropdownMenuItem onClick={() => run(() => setCampaignStatus(c.id, "ENDED"), "Beendet.")}>
              <Square className="size-4" /> Beenden
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => run(() => duplicateCampaign(c.id), "Dupliziert.")}>
            <Copy className="size-4" /> Duplizieren
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (!confirm(`Kampagne „${c.name}“ wirklich löschen?`)) return;
              run(() => deleteCampaign(c.id), "Gelöscht.");
            }}
          >
            <Trash2 className="size-4" /> Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kampagne veröffentlichen</DialogTitle>
            <DialogDescription>
              Bitte prüfe die Eckdaten. Eine Kampagne wird niemals versehentlich geschaltet.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <Row k="Kampagne" v={c.name} />
            <Row k="Plattformen" v={c.platforms.map(platformLabel).join(", ") || "—"} />
            <Row k="Tagesbudget" v={formatEuroCents(c.dailyBudgetCents)} />
            <Row k="Gesamtbudget" v={formatEuroCents(c.totalBudgetCents)} />
            <Row k="Laufzeit" v={`${c.startDate ?? "—"} → ${c.endDate ?? "offen"}`} />
          </dl>
          {highBudget && (
            <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm">
              <p className="font-medium text-warning">Hohes Budget</p>
              <p className="text-muted-foreground">
                Das Gesamtbudget liegt bei {formatEuroCents(c.totalBudgetCents)}. Tippe zur Bestätigung{" "}
                <span className="font-semibold">VERÖFFENTLICHEN</span>.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-1.5 text-sm"
                placeholder="VERÖFFENTLICHEN"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>Abbrechen</Button>
            <Button onClick={doPublish} disabled={pending || publishBlocked}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Jetzt veröffentlichen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
