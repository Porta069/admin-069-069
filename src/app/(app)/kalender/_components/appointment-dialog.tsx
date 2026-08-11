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
import { createAppointment } from "../actions";

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentCreateDialog({
  employees,
  currentEmployeeId,
  initialOpen = false,
}: {
  employees: { id: string; name: string }[];
  currentEmployeeId: string;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startsAt, setStartsAt] = React.useState(defaultStart);
  const [endsAt, setEndsAt] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState(currentEmployeeId);

  const submit = () => {
    if (!title.trim()) {
      toast.error("Bitte einen Titel angeben.");
      return;
    }
    const effectiveEnd =
      endsAt ||
      (startsAt
        ? toLocalInput(new Date(new Date(startsAt).getTime() + 3600_000))
        : "");
    startTransition(async () => {
      const result = await createAppointment({
        title,
        description,
        startsAt,
        endsAt: effectiveEnd,
        location,
        employeeId,
      });
      if (result.ok) {
        toast.success("Termin erstellt");
        setTitle("");
        setDescription("");
        setLocation("");
        setStartsAt(defaultStart());
        setEndsAt("");
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
          Termin erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Termin erstellen</DialogTitle>
          <DialogDescription>
            Neuen Termin im Team-Kalender anlegen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="apt-title">Titel</Label>
            <Input
              id="apt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Interview mit Kandidat"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="apt-start">Beginn</Label>
              <Input
                id="apt-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="apt-end">Ende</Label>
              <Input
                id="apt-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                placeholder="Beginn + 1 Std."
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="apt-location">Ort</Label>
            <Input
              id="apt-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Telefonat, Büro, vor Ort…"
              maxLength={200}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Mitarbeiter</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
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
          <div className="grid gap-1.5">
            <Label htmlFor="apt-desc">Beschreibung</Label>
            <Textarea
              id="apt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Notizen zum Termin…"
              rows={3}
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
