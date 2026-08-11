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
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createAutomation } from "../actions";
import {
  ACTION_LABELS,
  ACTION_TYPES,
  TRIGGER_LABELS,
  TRIGGERS,
} from "./constants";

export function CreateAutomationDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState("");
  const [trigger, setTrigger] = React.useState("");
  const [actionType, setActionType] = React.useState("");

  const reset = () => {
    setName("");
    setTrigger("");
    setActionType("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!trigger || !actionType) {
      toast.error("Bitte Trigger und Aktions-Typ wählen.");
      return;
    }
    setPending(true);
    const result = await createAutomation({ name, trigger, actionType });
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
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Automation anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Automation anlegen</DialogTitle>
            <DialogDescription>
              Regel definieren — ausgeführt wird sie, sobald die Engine startet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="auto-name">Name</Label>
            <Input
              id="auto-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Neue Kandidaten sofort zuweisen"
              required
              minLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger (WENN)</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Trigger wählen" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aktions-Typ (DANN)</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aktion wählen" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
