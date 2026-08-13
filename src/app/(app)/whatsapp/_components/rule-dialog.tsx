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
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRule, updateRule } from "../actions";
import {
  DELAY_CHIPS,
  formatDelay,
  TEMPLATE_VARS,
  TRIGGERS,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_LABELS,
  type WhatsappTrigger,
} from "../constants";

export interface TemplateOption {
  id: string;
  name: string;
}

export interface RuleFormData {
  id: string;
  name: string;
  trigger: string;
  verzoegerungStunden: number;
  nachricht: string | null;
  templateId: string | null;
}

type Source = "nachricht" | "vorlage";

function RuleDialogInner({
  templates,
  rule,
  trigger,
}: {
  templates: TemplateOption[];
  /** Gesetzt = bearbeiten, sonst neu anlegen. */
  rule?: RuleFormData;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(rule);

  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [triggerValue, setTriggerValue] = React.useState<string>("");
  const [delay, setDelay] = React.useState<number>(0);
  const [source, setSource] = React.useState<Source>("nachricht");
  const [nachricht, setNachricht] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  const reset = React.useCallback(() => {
    setName(rule?.name ?? "");
    setTriggerValue(rule?.trigger ?? "");
    setDelay(rule?.verzoegerungStunden ?? 0);
    setSource(rule?.templateId ? "vorlage" : "nachricht");
    setNachricht(rule?.nachricht ?? "");
    setTemplateId(rule?.templateId ?? "");
  }, [rule]);

  const appendVariable = (variable: string) => {
    setNachricht((prev) =>
      prev.length === 0 || prev.endsWith(" ") || prev.endsWith("\n")
        ? prev + variable
        : `${prev} ${variable}`,
    );
    bodyRef.current?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (name.trim().length < 3) {
      toast.error("Bitte einen Namen mit mindestens 3 Zeichen angeben.");
      return;
    }
    if (!triggerValue) {
      toast.error("Bitte einen Auslöser wählen.");
      return;
    }
    if (source === "vorlage" && !templateId) {
      toast.error("Bitte eine Vorlage wählen.");
      return;
    }
    if (source === "nachricht" && nachricht.trim().length < 3) {
      toast.error("Bitte eine Nachricht schreiben oder eine Vorlage wählen.");
      return;
    }

    setPending(true);
    const payload = {
      name,
      trigger: triggerValue,
      verzoegerungStunden: delay,
      nachricht: source === "nachricht" ? nachricht : null,
      templateId: source === "vorlage" ? templateId : null,
    };
    const result = isEdit
      ? await updateRule({ id: rule!.id, ...payload })
      : await createRule(payload);
    setPending(false);

    if (result.ok) {
      toast.success(isEdit ? "Regel gespeichert" : "Regel angelegt");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const activeChip = DELAY_CHIPS.find((c) => c.hours === delay);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Regel bearbeiten" : "Regel erstellen"}
            </DialogTitle>
            <DialogDescription>
              Automatische WhatsApp-Nachricht — greift, sobald die Integration
              aktiv ist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="wa-name">Name</Label>
            <Input
              id="wa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Nach Registrierung begrüßen"
              required
              minLength={3}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>Auslöser</Label>
            <Select value={triggerValue} onValueChange={setTriggerValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Auslöser wählen" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {triggerValue && (
              <p className="text-xs text-muted-foreground">
                {TRIGGER_DESCRIPTIONS[triggerValue as WhatsappTrigger]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-delay">Verzögerung</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {DELAY_CHIPS.map((chip) => (
                <button
                  key={chip.hours}
                  type="button"
                  onClick={() => setDelay(chip.hours)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    delay === chip.hours
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                id="wa-delay"
                type="number"
                min={0}
                max={720}
                value={delay}
                onChange={(e) =>
                  setDelay(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-24 tabular"
              />
              <span className="text-sm text-muted-foreground">
                Stunden{!activeChip && ` — ${formatDelay(delay)}`}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Inhalt</Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSource("nachricht")}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  source === "nachricht"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                Nachricht schreiben
              </button>
              <button
                type="button"
                onClick={() => setSource("vorlage")}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  source === "vorlage"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                Vorlage übernehmen
              </button>
            </div>

            {source === "nachricht" ? (
              <>
                <Textarea
                  ref={bodyRef}
                  value={nachricht}
                  onChange={(e) => setNachricht(e.target.value)}
                  placeholder="Hallo {first_name}, …"
                  rows={5}
                  maxLength={1000}
                  className="text-sm"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-xs text-muted-foreground">
                    Variablen:
                  </span>
                  {TEMPLATE_VARS.map((v) => (
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
              </>
            ) : (
              <>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vorlage wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Noch keine Vorlagen vorhanden — zuerst unter „Vorlagen"
                    anlegen.
                  </p>
                )}
              </>
            )}
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
              {isEdit ? "Speichern" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Standard-Button im PageHeader zum Anlegen einer neuen Regel. */
export function CreateRuleDialog({
  templates,
}: {
  templates: TemplateOption[];
}) {
  return (
    <RuleDialogInner
      templates={templates}
      trigger={
        <Button>
          <Plus className="size-4" />
          Regel erstellen
        </Button>
      }
    />
  );
}

/** Bearbeiten-Dialog, ausgelöst über ein eigenes Trigger-Element. */
export function EditRuleDialog({
  templates,
  rule,
  trigger,
}: {
  templates: TemplateOption[];
  rule: RuleFormData;
  trigger: React.ReactNode;
}) {
  return <RuleDialogInner templates={templates} rule={rule} trigger={trigger} />;
}
