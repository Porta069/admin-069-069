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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createTemplate, updateTemplate } from "../actions";

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  EMAIL: "E-Mail",
  NACHRICHT: "Nachricht",
  BEWERBUNGSANTWORT: "Bewerbungsantwort",
  TERMINBESTAETIGUNG: "Terminbestätigung",
  ANSCHREIBEN: "Anschreiben",
};

// Muss zur Versand-Substitution passen (substituteVars ersetzt {{key}};
// unbekannte Platzhalter bleiben wörtlich stehen). Verfügbare Variablen kommen
// aus den Versandwegen (Angebot/Kandidat/Lead): name + datum immer, firma/stelle/
// kandidat je nach Kontext.
const VARIABLES = ["{{name}}", "{{firma}}", "{{stelle}}", "{{kandidat}}", "{{datum}}"];

export interface TemplateFormData {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
}

export function TemplateDialog({
  template,
  trigger,
  initialOpen = false,
}: {
  /** When set, the dialog edits this template; otherwise it creates a new one. */
  template?: TemplateFormData;
  trigger?: React.ReactNode;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(template?.name ?? "");
  const [type, setType] = React.useState(template?.type ?? "EMAIL");
  const [subject, setSubject] = React.useState(template?.subject ?? "");
  const [body, setBody] = React.useState(template?.body ?? "");
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  const appendVariable = (variable: string) => {
    setBody((prev) =>
      prev.length === 0 || prev.endsWith(" ") || prev.endsWith("\n")
        ? prev + variable
        : `${prev} ${variable}`,
    );
    bodyRef.current?.focus();
  };

  const submit = () => {
    if (!name.trim() || !body.trim()) {
      toast.error("Bitte Name und Inhalt angeben.");
      return;
    }
    startTransition(async () => {
      const result = template
        ? await updateTemplate({ id: template.id, name, type, subject, body })
        : await createTemplate({ name, type, subject, body });
      if (result.ok) {
        toast.success(template ? "Vorlage gespeichert" : "Vorlage erstellt");
        if (!template) {
          setName("");
          setSubject("");
          setBody("");
        }
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
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Vorlage erstellen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {template ? "Vorlage bearbeiten" : "Vorlage erstellen"}
          </DialogTitle>
          <DialogDescription>
            Wiederverwendbare Texte für E-Mails und Nachrichten.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-[1fr_14rem] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Einladung zum Interview"
                maxLength={200}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_TYPE_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-subject">Betreff</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreffzeile (optional)"
              maxLength={300}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-body">Inhalt</Label>
            <Textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hallo {{name}}, …"
              rows={9}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-muted-foreground">Variablen:</span>
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => appendVariable(v)}
                  className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary transition-colors hover:bg-accent"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? "Wird gespeichert…"
              : template
                ? "Speichern"
                : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
