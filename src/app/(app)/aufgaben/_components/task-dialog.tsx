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
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/definitions";
import { Plus } from "lucide-react";
import { createTask } from "../actions";

export interface EmployeeOption {
  id: string;
  name: string;
}

export function TaskCreateDialog({
  employees,
  currentEmployeeId,
  initialOpen = false,
}: {
  employees: EmployeeOption[];
  currentEmployeeId: string;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState(currentEmployeeId);
  const [dueAt, setDueAt] = React.useState("");
  const [priority, setPriority] = React.useState("NORMAL");

  const reset = () => {
    setTitle("");
    setDescription("");
    setAssigneeId(currentEmployeeId);
    setDueAt("");
    setPriority("NORMAL");
  };

  const submit = () => {
    if (!title.trim()) {
      toast.error("Bitte einen Titel angeben.");
      return;
    }
    startTransition(async () => {
      const result = await createTask({
        title,
        description,
        assigneeId,
        dueAt,
        priority,
      });
      if (result.ok) {
        toast.success("Aufgabe erstellt");
        reset();
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
          Aufgabe erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aufgabe erstellen</DialogTitle>
          <DialogDescription>
            Neue Aufgabe anlegen und einem Teammitglied zuweisen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Kandidat zurückrufen"
              maxLength={200}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-desc">Beschreibung</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Details…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Zuweisen an</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Mitarbeiter wählen" />
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
            <div className="grid gap-1.5">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-due">Fälligkeit</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Wird erstellt…" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
