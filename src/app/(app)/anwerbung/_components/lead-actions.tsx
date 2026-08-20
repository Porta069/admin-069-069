"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { renderVorlageEmail } from "@/lib/email-templates";
import { LEAD_STATUS, LEAD_STATUSES } from "../lead-defs";
import { createLead, updateLeadStatus, sendeLeadEmail, archiveLead } from "../actions";

const NONE = "__none__";

/** Neuen Lead (anzuwerbendes Unternehmen) anlegen. */
export function AddLeadDialog({
  employees,
}: {
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({
    name: "",
    ansprechpartner: "",
    email: "",
    phone: "",
    ort: "",
    website: "",
    quelle: "",
    notiz: "",
    assigneeId: NONE,
  });
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = () =>
    startTransition(async () => {
      const r = await createLead({
        name: f.name,
        ansprechpartner: f.ansprechpartner,
        email: f.email,
        phone: f.phone,
        ort: f.ort,
        website: f.website,
        quelle: f.quelle,
        notiz: f.notiz,
        assigneeId: f.assigneeId === NONE ? null : f.assigneeId,
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) {
        toast.success(r.message ?? "Lead angelegt.");
        setOpen(false);
        setF({
          name: "",
          ansprechpartner: "",
          email: "",
          phone: "",
          ort: "",
          website: "",
          quelle: "",
          notiz: "",
          assigneeId: NONE,
        });
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Unternehmen anwerben
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unternehmen als Lead anlegen</DialogTitle>
          <DialogDescription>
            Ein noch nicht registrierter Betrieb, den ihr anwerben wollt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="l-name">Firmenname</Label>
            <Input id="l-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="z. B. Muster Bau GmbH" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-ap">Ansprechpartner</Label>
            <Input id="l-ap" value={f.ansprechpartner} onChange={(e) => set("ansprechpartner", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-ort">Ort</Label>
            <Input id="l-ort" value={f.ort} onChange={(e) => set("ort", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-mail">E-Mail</Label>
            <Input id="l-mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-tel">Telefon</Label>
            <Input id="l-tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-web">Website</Label>
            <Input id="l-web" value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="muster-bau.de" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-q">Quelle</Label>
            <Input id="l-q" value={f.quelle} onChange={(e) => set("quelle", e.target.value)} placeholder="z. B. Google, Empfehlung" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Zuständig</Label>
            <Select value={f.assigneeId} onValueChange={(v) => set("assigneeId", v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Niemand</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="l-notiz">Notiz</Label>
            <Textarea id="l-notiz" rows={3} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline-Statuswechsel eines Leads. */
export function LeadStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Select
      value={status}
      onValueChange={(v) =>
        startTransition(async () => {
          const r = await updateLeadStatus(id, v).catch(() => ({
            ok: false as const,
            message: "Fehlgeschlagen.",
          }));
          if (r.ok) router.refresh();
          else toast.error(r.message);
        })
      }
    >
      <SelectTrigger className="h-8 w-[150px] bg-card text-xs" disabled={pending}>
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
  );
}

/** Anwerbungs-E-Mail an den Lead. */
export function LeadEmailButton({
  id,
  name,
  ansprechpartner,
  email,
}: {
  id: string;
  name: string;
  ansprechpartner: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [betreff, setBetreff] = React.useState("");
  const [nachricht, setNachricht] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const heute = React.useMemo(() => new Intl.DateTimeFormat("de-DE").format(new Date()), []);
  const preview = React.useMemo(() => {
    const vars = { firma: name, name: ansprechpartner || name, email: email ?? "", datum: heute };
    return renderVorlageEmail(
      { variante: "brief", titel: "", betreff, einleitung: nachricht, schluss: "", hervorhebung: "" },
      vars,
    );
  }, [betreff, nachricht, name, ansprechpartner, email, heute]);

  const senden = () =>
    startTransition(async () => {
      const r = await sendeLeadEmail(id, betreff, nachricht).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (r.ok) {
        toast.success(r.message ?? "E-Mail versendet.");
        setOpen(false);
        setBetreff("");
        setNachricht("");
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" title="E-Mail senden" disabled={!email}>
          <Mail className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>E-Mail an {name}</DialogTitle>
          <DialogDescription>
            {email ? `Wird echt an ${email} versendet.` : "Keine E-Mail-Adresse hinterlegt."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-betreff">Betreff</Label>
              <Input id="lead-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="Betreff der E-Mail" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-text">Nachricht</Label>
              <Textarea id="lead-text" rows={11} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder={"Sehr geehrte Damen und Herren,\n\n…"} />
            </div>
            <p className="text-xs text-muted-foreground">
              Platzhalter möglich: {"{{firma}}"}, {"{{name}}"}, {"{{datum}}"}.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Vorschau</Label>
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Betreff: </span>
                <span className="font-medium">{preview.subject || "—"}</span>
              </div>
              <iframe title="E-Mail-Vorschau" srcDoc={preview.html} sandbox="" className="h-80 w-full bg-white" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={senden} disabled={!email || pending || !betreff.trim() || !nachricht.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lead archivieren (Soft-Delete — nicht endgültig gelöscht). */
export function ArchiveLeadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      title="Archivieren"
      disabled={pending}
      onClick={() => {
        if (!confirm("Diesen Lead archivieren?")) return;
        startTransition(async () => {
          const r = await archiveLead(id).catch(() => ({
            ok: false as const,
            message: "Fehlgeschlagen.",
          }));
          if (r.ok) {
            toast.success(r.message ?? "Archiviert.");
            router.refresh();
          } else toast.error(r.message);
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
