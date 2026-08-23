"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Loader2, MessageSquarePlus, Search, UserSquare2, Building2, X } from "lucide-react";
import { sendePersoenlicheMitteilung, sucheTaggbareEntitaeten } from "../actions";

interface EmployeeOpt {
  id: string;
  name: string;
}
interface TagChip {
  entityType: "candidate" | "company";
  entityId: string;
  label: string;
}

export function NeueMitteilungDialog({ employees }: { employees: EmployeeOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [recipients, setRecipients] = React.useState<Set<string>>(new Set());
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [tags, setTags] = React.useState<TagChip[]>([]);
  const [suche, setSuche] = React.useState("");
  const [treffer, setTreffer] = React.useState<{
    kandidaten: { id: string; label: string }[];
    unternehmen: { id: string; label: string; hint: string | null }[];
  }>({ kandidaten: [], unternehmen: [] });
  const [pending, setPending] = React.useState(false);

  // Entity-Suche (leicht entprellt).
  React.useEffect(() => {
    if (suche.trim().length < 2) {
      setTreffer({ kandidaten: [], unternehmen: [] });
      return;
    }
    const t = setTimeout(async () => {
      const res = await sucheTaggbareEntitaeten(suche);
      setTreffer(res);
    }, 250);
    return () => clearTimeout(t);
  }, [suche]);

  const toggleRecipient = (id: string) =>
    setRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addTag = (t: TagChip) => {
    setTags((prev) =>
      prev.some((x) => x.entityType === t.entityType && x.entityId === t.entityId)
        ? prev
        : [...prev, t],
    );
    setSuche("");
    setTreffer({ kandidaten: [], unternehmen: [] });
  };
  const removeTag = (t: TagChip) =>
    setTags((prev) => prev.filter((x) => !(x.entityType === t.entityType && x.entityId === t.entityId)));

  const reset = () => {
    setRecipients(new Set());
    setTitle("");
    setBody("");
    setTags([]);
    setSuche("");
  };

  const senden = async () => {
    setPending(true);
    const res = await sendePersoenlicheMitteilung({
      recipientIds: [...recipients],
      title,
      body,
      tags: tags.map((t) => ({ entityType: t.entityType, entityId: t.entityId })),
    });
    setPending(false);
    if (res.ok) {
      toast.success(`An ${res.count} Mitarbeiter gesendet`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MessageSquarePlus className="size-4" /> Neue Mitteilung
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Persönliche Mitteilung</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Empfänger</Label>
            <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border p-1">
              {employees.map((e) => {
                const an = recipients.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleRecipient(e.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                      an && "bg-primary/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        an ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {an && <Check className="size-3" />}
                    </span>
                    {e.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mitteilung-titel">Betreff</Label>
            <Input
              id="mitteilung-titel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Worum geht's?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mitteilung-text">Nachricht</Label>
            <Textarea
              id="mitteilung-text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Optional — Details, Kontext …"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Taggen (Nutzer / Unternehmen)</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={`${t.entityType}-${t.entityId}`}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {t.entityType === "candidate" ? (
                      <UserSquare2 className="size-3" />
                    ) : (
                      <Building2 className="size-3" />
                    )}
                    {t.label}
                    <button type="button" onClick={() => removeTag(t)} aria-label="Entfernen">
                      <X className="size-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Name suchen…"
                className="pl-8"
              />
            </div>
            {(treffer.kandidaten.length > 0 || treffer.unternehmen.length > 0) && (
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-1">
                {treffer.kandidaten.map((k) => (
                  <button
                    key={`c-${k.id}`}
                    type="button"
                    onClick={() => addTag({ entityType: "candidate", entityId: k.id, label: k.label })}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <UserSquare2 className="size-3.5 text-muted-foreground" /> {k.label}
                  </button>
                ))}
                {treffer.unternehmen.map((u) => (
                  <button
                    key={`o-${u.id}`}
                    type="button"
                    onClick={() => addTag({ entityType: "company", entityId: u.id, label: u.label })}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <Building2 className="size-3.5 text-muted-foreground" /> {u.label}
                    {u.hint && <span className="text-xs text-muted-foreground">· {u.hint}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={senden} disabled={pending || recipients.size === 0 || !title.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
