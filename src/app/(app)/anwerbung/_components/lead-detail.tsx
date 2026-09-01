"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  CalendarClock,
  FileSignature,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/format";
import { LEAD_STATUS, LEAD_STATUSES } from "../lead-defs";
import { setTermin, uebernehmeAlsBetrieb, updateLeadStatus } from "../actions";

export interface Lead {
  id: string;
  name: string;
  ansprechpartner: string | null;
  email: string | null;
  phone: string | null;
  ort: string | null;
  website: string | null;
  status: string;
  termin_at: string | null;
  vertrag_at: string | null;
  company_id: string | null;
  assignee_name: string | null;
  assignee_color: string | null;
}

/** Wandelt einen ISO/DB-Zeitstempel in den Wert für <input type="datetime-local">. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/**
 * Detail-Dialog eines Anwerbungs-Leads: Status, Systemvorstellung planen, Vertrag
 * markieren und die Übergabe „Betrieb anlegen & Job inserieren". Öffnet über das
 * als `children` übergebene Trigger-Element.
 */
export function LeadDetail({
  lead,
  canEdit,
  children,
}: {
  lead: Lead;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [termin, setTerminInput] = React.useState(toLocalInput(lead.termin_at));

  React.useEffect(() => {
    if (open) setTerminInput(toLocalInput(lead.termin_at));
  }, [open, lead.termin_at]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn().catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (r.ok) {
        toast.success(r.message ?? ok);
        router.refresh();
      } else {
        toast.error(r.message ?? "Fehlgeschlagen.");
      }
    });

  const speichereTermin = () =>
    run(() => setTermin(lead.id, termin ? new Date(termin).toISOString() : null), "Termin gespeichert.");

  const uebernehmen = () =>
    startTransition(async () => {
      const r = await uebernehmeAlsBetrieb(lead.id).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (r.ok) {
        toast.success(r.message ?? "Betrieb angelegt.");
        setOpen(false);
        // Direkt zur Stellenanlage mit vorausgewähltem Betrieb.
        router.push(
          r.companyId
            ? `/stellen?neu=1&company=${encodeURIComponent(r.companyId)}`
            : "/stellen?neu=1",
        );
      } else {
        toast.error(r.message ?? "Übernahme fehlgeschlagen.");
      }
    });

  const verknuepft = Boolean(lead.company_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.name}
            <StatusBadge map={LEAD_STATUS} value={lead.status} />
          </DialogTitle>
          <DialogDescription>Anwerbungs-Pipeline — Betrieb noch nicht auf der Plattform.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kontaktinfo */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {lead.ansprechpartner && (
              <div className="col-span-2 flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                {lead.ansprechpartner}
              </div>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="col-span-2 flex items-center gap-2 hover:text-primary">
                <Mail className="size-4 text-muted-foreground" />
                <span className="truncate">{lead.email}</span>
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2 hover:text-primary">
                <Phone className="size-4 text-muted-foreground" />
                {lead.phone}
              </a>
            )}
            {lead.ort && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {lead.ort}
              </div>
            )}
          </dl>

          {canEdit && (
            <>
              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={lead.status}
                  onValueChange={(v) => run(() => updateLeadStatus(lead.id, v), "Status aktualisiert.")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LEAD_STATUS[s]?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Systemvorstellung / Team-Meeting */}
              <div className="space-y-1.5 rounded-md border p-3">
                <Label htmlFor="lead-termin" className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  Systemvorstellung (Team-Meeting)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="lead-termin"
                    type="datetime-local"
                    value={termin}
                    onChange={(e) => setTerminInput(e.target.value)}
                  />
                  <Button variant="outline" onClick={speichereTermin} disabled={pending}>
                    {pending ? <Loader2 className="size-4 animate-spin" /> : "Planen"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Setzt den Status auf „Systemvorstellung", sofern der Lead noch früher steht.
                </p>
              </div>

              {/* Vertrag */}
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-start gap-2 text-sm">
                  <FileSignature className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Vertrag</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.vertrag_at
                        ? `Unterschrieben am ${formatDateTime(lead.vertrag_at)}`
                        : "Noch nicht unterschrieben."}
                    </p>
                  </div>
                </div>
                {lead.status !== "VERTRAG" && lead.status !== "GEWONNEN" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => updateLeadStatus(lead.id, "VERTRAG"), "Vertrag vermerkt.")}
                  >
                    Unterschrieben
                  </Button>
                )}
              </div>

              {/* Übergabe ans Inserat */}
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                {verknuepft ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Betrieb ist angelegt & verknüpft.</span>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/unternehmen/${lead.company_id}`}>Betriebsakte</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/stellen?neu=1&company=${encodeURIComponent(lead.company_id!)}`}>
                          Stelle inserieren
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-sm font-medium">Übergabe ans Inserat</p>
                    <Button onClick={uebernehmen} disabled={pending} className="w-full">
                      {pending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                      Betrieb anlegen & Job inserieren
                    </Button>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Legt den Betrieb über die Backend-Schnittstelle an und springt zur Stellenanlage.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
