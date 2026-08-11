"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { logCommunication } from "../actions";

export interface LinkOption {
  id: string;
  label: string;
}

const NONE = "__none__";

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CommunicationLogDialog({
  candidates,
  companies,
  initialOpen = false,
}: {
  candidates: LinkOption[];
  companies: LinkOption[];
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  const [channel, setChannel] = React.useState("TELEFON");
  const [direction, setDirection] = React.useState("OUTBOUND");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [link, setLink] = React.useState(NONE);
  const [occurredAt, setOccurredAt] = React.useState(nowLocal);

  const submit = () => {
    if (!subject.trim() && !body.trim()) {
      toast.error("Bitte Betreff oder Inhalt angeben.");
      return;
    }
    const [entityType, entityId] =
      link === NONE ? ["", ""] : (link.split(":") as [string, string]);
    startTransition(async () => {
      const result = await logCommunication({
        channel,
        direction,
        subject,
        body,
        entityType,
        entityId,
        occurredAt,
      });
      if (result.ok) {
        toast.success("Kommunikation protokolliert");
        setSubject("");
        setBody("");
        setLink(NONE);
        setOccurredAt(nowLocal());
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
          <Plus className="size-4" />
          Kommunikation loggen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kommunikation loggen</DialogTitle>
          <DialogDescription>
            E-Mail, Anruf oder Nachricht manuell protokollieren.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kanal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMAIL">E-Mail</SelectItem>
                  <SelectItem value="TELEFON">Telefon</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SONSTIGE">Sonstige</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Richtung</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUTBOUND">Ausgehend</SelectItem>
                  <SelectItem value="INBOUND">Eingehend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="comm-subject">Betreff</Label>
            <Input
              id="comm-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="z. B. Rückruf wegen Bewerbung"
              maxLength={300}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="comm-body">Inhalt</Label>
            <Textarea
              id="comm-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Kurze Zusammenfassung des Gesprächs bzw. der Nachricht…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Verknüpft mit</Label>
              <Select value={link} onValueChange={setLink}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Keine Verknüpfung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine Verknüpfung</SelectItem>
                  {candidates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Kandidaten</SelectLabel>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={`candidate:${c.id}`}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {companies.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Unternehmen</SelectLabel>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={`company:${c.id}`}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comm-at">Zeitpunkt</Label>
              <Input
                id="comm-at"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Wird gespeichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
