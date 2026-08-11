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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { createAutomation } from "../actions";
import {
  ACTION_LABELS,
  SUPPORTED_TRIGGERS,
  TRIGGER_ACTIONS,
  TRIGGER_LABELS,
  type AutomationActionType,
  type SupportedTrigger,
} from "./constants";

export interface TemplateOption {
  id: string;
  name: string;
}

function AutomationDialogInner({
  templates,
  initialName = "",
  initialTrigger = "",
  initialActionType = "",
  trigger,
}: {
  templates: TemplateOption[];
  initialName?: string;
  initialTrigger?: string;
  initialActionType?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [triggerValue, setTriggerValue] = React.useState(initialTrigger);
  const [actionType, setActionType] = React.useState(initialActionType);
  const [templateId, setTemplateId] = React.useState("");

  const availableActions: AutomationActionType[] =
    triggerValue && SUPPORTED_TRIGGERS.includes(triggerValue as SupportedTrigger)
      ? TRIGGER_ACTIONS[triggerValue as SupportedTrigger]
      : [];
  const actionIsFixed = triggerValue === "INTERVIEW_UPCOMING";
  const needsTemplate = actionType === "SEND_TEMPLATE";

  const reset = () => {
    setName(initialName);
    setTriggerValue(initialTrigger);
    setActionType(initialActionType);
    setTemplateId("");
  };

  const onTriggerChange = (value: string) => {
    setTriggerValue(value);
    setTemplateId("");
    const actions = SUPPORTED_TRIGGERS.includes(value as SupportedTrigger)
      ? TRIGGER_ACTIONS[value as SupportedTrigger]
      : [];
    // Bei genau einer möglichen Aktion direkt vorwählen.
    setActionType(actions.length === 1 ? actions[0] : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!triggerValue || !actionType) {
      toast.error("Bitte Trigger und Aktions-Typ wählen.");
      return;
    }
    if (needsTemplate && !templateId) {
      toast.error("Bitte eine Vorlage wählen.");
      return;
    }
    setPending(true);
    const result = await createAutomation({
      name,
      trigger: triggerValue,
      actionType,
      templateId: needsTemplate ? templateId : null,
    });
    setPending(false);
    if (result.ok) {
      toast.success("Automation wurde angelegt");
      setOpen(false);
      reset();
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Automation anlegen</DialogTitle>
            <DialogDescription>
              Läuft automatisch alle 5 Minuten bei aktiver Nutzung (+ täglicher
              Cron).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="auto-name">Name</Label>
            <Input
              id="auto-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Neue Kandidaten sofort begrüßen"
              required
              minLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger (WENN)</Label>
            <Select value={triggerValue} onValueChange={onTriggerChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Trigger wählen" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aktions-Typ (DANN)</Label>
            <Select
              value={actionType}
              onValueChange={setActionType}
              disabled={!triggerValue || actionIsFixed}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    triggerValue ? "Aktion wählen" : "Zuerst Trigger wählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionIsFixed && (
              <p className="text-xs text-muted-foreground">
                Die Terminerinnerung wird automatisch an die zuständige Person
                gesendet — die Aktion ist fest.
              </p>
            )}
          </div>

          {needsTemplate && (
            <div className="space-y-2">
              <Label>Vorlage</Label>
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
                  Noch keine Vorlagen vorhanden — zuerst unter „Vorlagen“
                  anlegen.
                </p>
              )}
            </div>
          )}

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
              Anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Standard-Button im PageHeader. */
export function CreateAutomationDialog({
  templates,
}: {
  templates: TemplateOption[];
}) {
  return (
    <AutomationDialogInner
      templates={templates}
      trigger={
        <Button>
          <Plus className="size-4" />
          Automation anlegen
        </Button>
      }
    />
  );
}

/** „Einrichten“-Button auf Rezept-Karten — öffnet den Dialog vorbefüllt. */
export function RecipeSetupButton({
  templates,
  name,
  trigger,
  actionType,
}: {
  templates: TemplateOption[];
  name: string;
  trigger: SupportedTrigger;
  actionType: AutomationActionType;
}) {
  return (
    <AutomationDialogInner
      templates={templates}
      initialName={name}
      initialTrigger={trigger}
      initialActionType={actionType}
      trigger={
        <Button variant="outline" size="sm" className="bg-card">
          <Settings2 className="size-4" />
          Einrichten
        </Button>
      }
    />
  );
}
