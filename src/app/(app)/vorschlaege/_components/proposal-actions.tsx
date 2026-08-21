"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { formatEuroCents } from "@/lib/format";
import {
  declineProposal,
  markProposalPlaced,
  sendOffer,
  setProposalStatus,
  type AngebotVorlage,
} from "../actions";

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseEuroInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

type DialogKind = null | "offer" | "decline" | "placed";

export function ProposalActions({
  id,
  status,
  candidateName,
  jobTitle,
  companyName,
  baseFeeCents,
  maxCommissionCents,
  candidateEmail,
  templates,
}: {
  id: string;
  status: string;
  candidateName: string;
  jobTitle: string | null;
  companyName: string | null;
  baseFeeCents: number;
  maxCommissionCents: number;
  candidateEmail: string | null;
  templates: AngebotVorlage[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<DialogKind>(null);

  const [offerMessage, setOfferMessage] = React.useState("");
  const [sendEmail, setSendEmail] = React.useState(false);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [commission, setCommission] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const isDone = status === "VERMITTELT" || status === "ABGELEHNT";

  const changeSimple = (next: string) => {
    if (next === status) return;
    startTransition(async () => {
      const result = await setProposalStatus(id, next);
      if (result.ok) toast.success(result.message ?? "Status aktualisiert.");
      else toast.error(result.message);
    });
  };

  const submitOffer = () => {
    startTransition(async () => {
      const result = await sendOffer(id, offerMessage, {
        sendEmail: sendEmail && Boolean(templateId),
        templateId: sendEmail ? templateId : null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Angebot hinterlegt.", { duration: 6000 });
        setOfferMessage("");
        setSendEmail(false);
        setTemplateId(null);
        setDialog(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  const submitDecline = () => {
    startTransition(async () => {
      const result = await declineProposal(id, declineReason);
      if (result.ok) {
        toast.success(result.message ?? "Vorschlag abgelehnt.");
        setDeclineReason("");
        setDialog(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  const submitPlaced = () => {
    const commissionParsed = parseEuroInput(commission);
    if (commissionParsed === null) {
      toast.error("Bitte eine gültige Provision angeben.");
      return;
    }
    if (commissionParsed > maxCommissionCents) {
      toast.error(
        `Die Provision darf maximal ${formatEuroCents(maxCommissionCents)} betragen.`,
      );
      return;
    }
    startTransition(async () => {
      const result = await markProposalPlaced({
        id,
        commissionCents: commissionParsed,
        notes: notes || null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Vermittlung angelegt.");
        setCommission("");
        setNotes("");
        setDialog(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  const commissionParsed = parseEuroInput(commission) ?? 0;
  const total = baseFeeCents + commissionParsed;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Aktion
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Status ändern</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => changeSimple("BETRIEB_INTERESSIERT")}
            disabled={isDone || status === "BETRIEB_INTERESSIERT"}
          >
            Betrieb interessiert
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDialog("offer")}
            disabled={isDone}
          >
            Angebot senden…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => changeSimple("ANGENOMMEN")}
            disabled={isDone || status === "ANGENOMMEN"}
          >
            Angebot angenommen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDialog("placed")}
            disabled={status === "VERMITTELT"}
          >
            Als vermittelt abschließen…
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDialog("decline")}
            disabled={isDone}
          >
            Ablehnen…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Angebot-Dialog */}
      <Dialog
        open={dialog === "offer"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Angebot senden</DialogTitle>
            <DialogDescription>
              Angebot für {candidateName}
              {jobTitle ? ` — ${jobTitle}` : ""} festhalten. Der Vorschlag wechselt
              auf „Angebot".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pw-offer-msg">Angebots-Nachricht *</Label>
            <Textarea
              id="pw-offer-msg"
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              rows={4}
              placeholder="Konditionen, Startdatum, Ansprechpartner…"
            />
          </div>

          {/* Optionaler E-Mail-Versand an den Kandidaten aus einer Vorlage */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={sendEmail}
                disabled={!candidateEmail || templates.length === 0}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              E-Mail an den Kandidaten senden
            </label>
            {!candidateEmail ? (
              <p className="text-xs text-muted-foreground">
                Für diesen Kandidaten ist keine E-Mail-Adresse hinterlegt.
              </p>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Noch keine E-Mail-Vorlage vorhanden —{" "}
                <Link href="/vorlagen" className="text-primary hover:underline">in der Vorlagen-Sektion anlegen</Link>.
              </p>
            ) : (
              sendEmail && (
                <div className="space-y-1.5">
                  <Select value={templateId ?? undefined} onValueChange={setTemplateId}>
                    <SelectTrigger className="w-full bg-card"><SelectValue placeholder="Vorlage wählen…" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    An {candidateEmail}. Platzhalter: {"{{name}}"}, {"{{stelle}}"}, {"{{firma}}"}, {"{{datum}}"}.
                    Vorlagen verwaltest du unter{" "}
                    <Link href="/vorlagen" className="text-primary hover:underline">Vorlagen</Link>.
                  </p>
                </div>
              )
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Abbrechen
            </Button>
            <Button onClick={submitOffer} disabled={pending || (sendEmail && !templateId)}>
              {pending ? "Speichert…" : sendEmail ? "Angebot + E-Mail senden" : "Angebot hinterlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ablehnen-Dialog */}
      <Dialog
        open={dialog === "decline"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vorschlag ablehnen</DialogTitle>
            <DialogDescription>
              Grund der Ablehnung für {candidateName} festhalten (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pw-decline-reason">Ablehnungsgrund</Label>
            <Textarea
              id="pw-decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              placeholder="z. B. Betrieb hat sich anders entschieden…"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={submitDecline}
              disabled={pending}
            >
              {pending ? "Speichert…" : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vermittelt-Dialog */}
      <Dialog
        open={dialog === "placed"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Als vermittelt abschließen</DialogTitle>
            <DialogDescription>
              Legt eine Vermittlung für {candidateName}
              {companyName ? ` bei ${companyName}` : ""} an. Der Match-Score wird
              aus dem Vorschlag übernommen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grundgebühr</Label>
                <Input
                  value={centsToInput(baseFeeCents)}
                  readOnly
                  className="tabular bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  aus Preis-Einstellungen
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-commission">Provision (€)</Label>
                <Input
                  id="pw-commission"
                  inputMode="decimal"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0,00"
                  className="tabular"
                />
                <p className="text-xs text-muted-foreground">
                  max. {formatEuroCents(maxCommissionCents)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">Gesamt</span>
              <span className="font-medium tabular">{formatEuroCents(total)}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-placed-notes">Notiz (optional)</Label>
              <Textarea
                id="pw-placed-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="z. B. Startdatum, Absprachen…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Abbrechen
            </Button>
            <Button onClick={submitPlaced} disabled={pending}>
              {pending ? "Speichert…" : "Vermittlung anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
