"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MailPlus, Plus, Send, Star, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renderVorlageEmail } from "@/lib/email-templates";
import {
  vorlagenFuerVersand,
  sendeVorlageAnKandidat,
  type VersandVorlage,
} from "../actions";

type ActionResult = { ok: boolean; message?: string };

const NONE = "__none__";

/** URL-unabhängiges Select, das direkt eine Server Action auslöst. */
export function ActionSelect({
  entityId,
  value,
  options,
  placeholder,
  emptyLabel,
  action,
}: {
  entityId: string;
  value: string | null;
  options: { value: string; label: string }[];
  placeholder?: string;
  /** Wenn gesetzt, gibt es eine „leer"-Option, die als null übergeben wird. */
  emptyLabel?: string;
  action: (id: string, value: string | null) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="relative">
      <Select
        value={value ?? (emptyLabel ? NONE : undefined)}
        disabled={pending}
        onValueChange={(v) =>
          startTransition(async () => {
            const result = await action(entityId, v === NONE ? null : v).catch(
              () => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }),
            );
            if (result.ok) {
              toast.success(result.message ?? "Gespeichert.");
              router.refresh();
            } else {
              toast.error(result.message ?? "Aktion fehlgeschlagen.");
            }
          })
        }
      >
        <SelectTrigger className="w-full bg-card" size="sm">
          <SelectValue placeholder={placeholder ?? "Auswählen…"} />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && (
        <Loader2 className="absolute top-1/2 right-8 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

/** Dialog: Notiz anlegen. */
export function NoteDialog({
  entityId,
  categories,
  action,
  defaultCategory,
  triggerLabel = "Notiz hinzufügen",
  triggerVariant = "outline",
}: {
  entityId: string;
  categories: string[];
  action: (id: string, content: string, category: string) => Promise<ActionResult>;
  defaultCategory?: string;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState(defaultCategory ?? categories[0] ?? "ALLGEMEIN");
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await action(entityId, content, category).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Notiz gespeichert.");
        setContent("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Notiz konnte nicht gespeichert werden.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" className="bg-card">
          <StickyNote className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notiz hinzufügen</DialogTitle>
          <DialogDescription>
            Die Notiz ist intern und für alle Mitarbeitenden sichtbar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-category">Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="note-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">Notiz</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Was gibt es festzuhalten?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || content.trim().length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog: Aufgabe anlegen. */
export function TaskDialog({
  entityId,
  employees,
  currentEmployeeId,
  action,
}: {
  entityId: string;
  employees: { id: string; name: string }[];
  currentEmployeeId: string;
  action: (
    id: string,
    payload: {
      title: string;
      description?: string;
      dueAt?: string | null;
      priority?: string;
      assigneeId?: string | null;
    },
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");
  const [assigneeId, setAssigneeId] = React.useState(currentEmployeeId);
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await action(entityId, {
        title,
        description,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        priority,
        assigneeId,
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (result.ok) {
        toast.success(result.message ?? "Aufgabe angelegt.");
        setTitle("");
        setDescription("");
        setDueAt("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Aufgabe konnte nicht angelegt werden.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <Plus className="size-4" />
          Aufgabe anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aufgabe anlegen</DialogTitle>
          <DialogDescription>
            Die Aufgabe erscheint im Aufgaben-Modul und in der Timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Rückruf vereinbaren"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Beschreibung (optional)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due">Fällig am</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRINGEND">Dringend</SelectItem>
                  <SelectItem value="HOCH">Hoch</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="NIEDRIG">Niedrig</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Zuständig</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || title.trim().length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog: Termin-Bewertung — Freundlichkeit (1–5) + bester Job-Match + Notiz. */
export function ReviewDialog({
  entityId,
  candidateName,
  jobs,
  action,
}: {
  entityId: string;
  candidateName: string;
  jobs: { jobId: string; title: string; companyName: string | null; score: number }[];
  action: (
    id: string,
    candidateName: string,
    payload: {
      freundlichkeit: number;
      jobId: string | null;
      jobTitle: string | null;
      notiz: string;
    },
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [freundlichkeit, setFreundlichkeit] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [jobId, setJobId] = React.useState<string>(jobs[0]?.jobId ?? NONE);
  const [notiz, setNotiz] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      const job = jobs.find((j) => j.jobId === jobId) ?? null;
      const result = await action(entityId, candidateName, {
        freundlichkeit,
        jobId: job?.jobId ?? null,
        jobTitle: job?.title ?? null,
        notiz,
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (result.ok) {
        toast.success(result.message ?? "Bewertung gespeichert.");
        setFreundlichkeit(0);
        setNotiz("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Bewertung konnte nicht gespeichert werden.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <Star className="size-4" />
          Termin bewerten
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Termin bewerten</DialogTitle>
          <DialogDescription>
            Wie war der persönliche Eindruck von {candidateName}, und welche Stelle
            passt nach dem Gespräch am besten?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Freundlichkeit</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setFreundlichkeit(n)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                  aria-label={`${n} von 5`}
                >
                  <Star
                    className={cn(
                      "size-6",
                      (hover || freundlichkeit) >= n
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
              {freundlichkeit > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {freundlichkeit}/5
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bester Job-Match</Label>
            {jobs.length > 0 ? (
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Stelle wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.jobId} value={j.jobId}>
                      {j.title}
                      {j.companyName ? ` · ${j.companyName}` : ""} ({Math.round(j.score)}%)
                    </SelectItem>
                  ))}
                  <SelectItem value={NONE}>Kein passender Match</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine bewertbaren Stellen vorhanden.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-notiz">Notiz (optional)</Label>
            <Textarea
              id="review-notiz"
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="Eindruck vom Termin, Auffälligkeiten, nächste Schritte …"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || freundlichkeit === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Bewertung speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog: Kommunikation protokollieren. */
export function CommunicationDialog({
  entityId,
  action,
}: {
  entityId: string;
  action: (
    id: string,
    payload: { channel: string; direction: string; subject?: string; body?: string },
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [channel, setChannel] = React.useState("TELEFON");
  const [direction, setDirection] = React.useState("OUTBOUND");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await action(entityId, { channel, direction, subject, body }).catch(
        () => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }),
      );
      if (result.ok) {
        toast.success(result.message ?? "Eintrag gespeichert.");
        setSubject("");
        setBody("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Eintrag konnte nicht gespeichert werden.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <Plus className="size-4" />
          Eintrag loggen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kommunikation protokollieren</DialogTitle>
          <DialogDescription>
            Halte Telefonate, E-Mails und Nachrichten zentral fest.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kanal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TELEFON">Telefon</SelectItem>
                  <SelectItem value="EMAIL">E-Mail</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SONSTIGE">Sonstige</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="comm-subject">Betreff (optional)</Label>
            <Input
              id="comm-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comm-body">Inhalt / Zusammenfassung</Label>
            <Textarea
              id="comm-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || body.trim().length === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog: vorgefertigte E-Mail (Account deaktiviert, Verstoß …) an die Person senden. */
export function VorlageEmailDialog({
  applicationId,
  candidateName,
  candidateEmail,
}: {
  applicationId: string;
  candidateName: string;
  candidateEmail: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [vorlagen, setVorlagen] = React.useState<VersandVorlage[] | null>(null);
  const [ladeFehler, setLadeFehler] = React.useState<string | null>(null);
  const [event, setEvent] = React.useState("");
  const [vars, setVars] = React.useState<Record<string, string>>({});
  const [loadPending, startLoad] = React.useTransition();
  const [sendPending, startSend] = React.useTransition();

  const heute = React.useMemo(
    () => new Intl.DateTimeFormat("de-DE").format(new Date()),
    [],
  );

  React.useEffect(() => {
    if (open && vorlagen === null && !loadPending && !ladeFehler) {
      startLoad(async () => {
        const r = await vorlagenFuerVersand().catch(() => ({
          ok: false as const,
          message: "Verbindung fehlgeschlagen.",
        }));
        if (r.ok) setVorlagen(r.vorlagen);
        else setLadeFehler(r.message);
      });
    }
  }, [open, vorlagen, loadPending, ladeFehler]);

  const selected = vorlagen?.find((v) => v.event === event) ?? null;

  const selectVorlage = (ev: string) => {
    setEvent(ev);
    const v = vorlagen?.find((x) => x.event === ev);
    if (!v) return;
    const initial: Record<string, string> = {};
    for (const variable of v.variablen) {
      if (variable.key === "name") initial[variable.key] = candidateName;
      else if (variable.key === "email") initial[variable.key] = candidateEmail ?? "";
      else if (variable.key === "datum") initial[variable.key] = heute;
      else initial[variable.key] = variable.beispiel ?? "";
    }
    setVars(initial);
  };

  const preview = React.useMemo(
    () => (selected ? renderVorlageEmail(selected, vars) : null),
    [selected, vars],
  );

  const senden = () => {
    if (!selected) return;
    startSend(async () => {
      const r = await sendeVorlageAnKandidat(applicationId, selected.event, vars).catch(
        () => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }),
      );
      if (r.ok) {
        toast.success(r.message ?? "E-Mail eingereiht.");
        setOpen(false);
        setEvent("");
        router.refresh();
      } else {
        toast.error(r.message ?? "E-Mail konnte nicht gesendet werden.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <MailPlus className="size-4" />
          Vorgefertigte E-Mail
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vorgefertigte E-Mail senden</DialogTitle>
          <DialogDescription>
            {candidateEmail
              ? `Wird echt an ${candidateEmail} versendet.`
              : "Für diese Person ist keine E-Mail-Adresse hinterlegt."}
          </DialogDescription>
        </DialogHeader>

        {ladeFehler ? (
          <p className="text-sm text-destructive">{ladeFehler}</p>
        ) : vorlagen === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Vorlagen werden geladen…
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Vorlage</Label>
                <Select value={event} onValueChange={selectVorlage}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vorlage wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vorlagen.map((v) => (
                      <SelectItem key={v.event} value={v.event}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selected && selected.variablen.length > 0 && (
                <div className="space-y-3">
                  {selected.variablen.map((variable) => (
                    <div className="space-y-1.5" key={variable.key}>
                      <Label htmlFor={`var-${variable.key}`}>{variable.label}</Label>
                      <Input
                        id={`var-${variable.key}`}
                        value={vars[variable.key] ?? ""}
                        onChange={(e) =>
                          setVars((s) => ({ ...s, [variable.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Vorschau</Label>
              {preview ? (
                <div className="overflow-hidden rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Betreff: </span>
                    <span className="font-medium">{preview.subject}</span>
                  </div>
                  <iframe
                    title="E-Mail-Vorschau"
                    srcDoc={preview.html}
                    sandbox=""
                    className="h-80 w-full bg-white"
                  />
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                  Wähle links eine Vorlage.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={senden}
            disabled={!selected || !candidateEmail || sendPending}
          >
            {sendPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
