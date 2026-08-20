"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { PermissionMap } from "@/lib/permissions";
import { PermissionMatrix } from "@/components/rbac/permission-matrix";
import type { Selection } from "@/lib/rbac";
import { createTemplate, updateTemplate, deleteTemplate } from "../actions";

const LEVELS = [
  { value: 20, label: "Mitarbeiter (20)" },
  { value: 40, label: "Fortgeschritten (40)" },
  { value: 60, label: "Teamleiter (60)" },
  { value: 80, label: "Manager (80)" },
];

export function TemplateDialog({
  actorPermissions,
  actorLevel,
  isMaster,
  lockPermissions = false,
  template,
}: {
  actorPermissions: PermissionMap;
  actorLevel: number;
  isMaster: boolean;
  /** Master-Rolle: Berechtigungen + Stufe gesperrt, nur Name/Beschreibung/Icon. */
  lockPermissions?: boolean;
  template?: {
    id: string; name: string; description: string; icon: string; level: number; selection: Selection;
  };
}) {
  const router = useRouter();
  const editing = Boolean(template);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(template?.name ?? "");
  const [description, setDescription] = React.useState(template?.description ?? "");
  const [icon, setIcon] = React.useState(template?.icon ?? "");
  const [level, setLevel] = React.useState(template?.level ?? 20);
  const [selection, setSelection] = React.useState<Selection>(template?.selection ?? {});
  const [pending, startTransition] = React.useTransition();

  const levelOptions = LEVELS.filter((l) => isMaster || l.value < actorLevel);

  const submit = () =>
    startTransition(async () => {
      const payload = { name, description, icon, level, selection };
      const r = await (editing
        ? updateTemplate(template!.id, payload)
        : createTemplate(payload)
      ).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) {
        toast.success(editing ? "Template gespeichert." : "Template erstellt.");
        setOpen(false);
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm"><Pencil className="size-4" /> Bearbeiten</Button>
        ) : (
          <Button size="sm"><Plus className="size-4" /> Neues Template</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Template bearbeiten" : "Neues Template"}</DialogTitle>
          <DialogDescription>
            Berechtigungen zusammenstellen. Du kannst nur Rechte vergeben, die du selbst besitzt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Telefonischer Mitarbeiter" />
          </div>
          <div className="space-y-1.5">
            <Label>Icon (Emoji)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📞" maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Stufe</Label>
            <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))} disabled={lockPermissions}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {levelOptions.map((l) => <SelectItem key={l.value} value={String(l.value)}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label>Beschreibung</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mt-2">
          {lockPermissions && (
            <p className="mb-2 text-xs text-warning">
              Die Berechtigungen und Stufe der Master-Rolle sind gesperrt (Sicherheitsanker) — nur Name,
              Beschreibung und Icon sind änderbar.
            </p>
          )}
          <PermissionMatrix
            value={selection}
            onChange={lockPermissions ? undefined : setSelection}
            actorPermissions={actorPermissions}
            readOnly={lockPermissions}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={pending || name.trim().length < 2}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? "Speichern" : "Template erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost" size="sm" className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Template „${name}" löschen?`)) return;
        startTransition(async () => {
          const r = await deleteTemplate(id).catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
          if (r.ok) { toast.success("Template gelöscht."); router.refresh(); }
          else toast.error(r.message);
        });
      }}
    >
      <Trash2 className="size-4" /> Löschen
    </Button>
  );
}
