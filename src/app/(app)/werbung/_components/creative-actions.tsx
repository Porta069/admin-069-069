"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { createCreative, deleteCreative } from "../actions";

export function AddCreativeDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", typ: "IMAGE", url: "", aspect: "9:16", tags: "", notiz: "" });
  const [pending, startTransition] = React.useTransition();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = () =>
    startTransition(async () => {
      const r = await createCreative({
        name: f.name, typ: f.typ, url: f.url || undefined, aspectRatio: f.aspect,
        notiz: f.notiz || undefined,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) {
        toast.success(r.message ?? "Creative angelegt.");
        setOpen(false);
        setF({ name: "", typ: "IMAGE", url: "", aspect: "9:16", tags: "", notiz: "" });
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Creative hinzufügen</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Creative anlegen</DialogTitle>
          <DialogDescription>
            Video oder Bild für die Wiederverwendung in Kampagnen. Datei-Upload folgt mit der Live-Anbindung —
            aktuell kann eine URL hinterlegt werden.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Elektriker Recruiting Video 01" />
          </div>
          <div className="space-y-1.5">
            <Label>Typ</Label>
            <Select value={f.typ} onValueChange={(v) => set("typ", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IMAGE">Bild</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={f.aspect} onValueChange={(v) => set("aspect", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["9:16", "1:1", "4:5", "16:9"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-url">Datei-URL (optional)</Label>
            <Input id="c-url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-tags">Tags (Komma-getrennt)</Label>
            <Input id="c-tags" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="elektriker, recruiting, hochkant" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="c-notiz">Notiz</Label>
            <Textarea id="c-notiz" rows={2} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={pending || !f.name.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCreativeButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive"
      title="Löschen" disabled={pending}
      onClick={() => {
        if (!confirm(`Creative „${name}“ löschen?`)) return;
        startTransition(async () => {
          const r = await deleteCreative(id).catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
          if (r.ok) { toast.success(r.message ?? "Gelöscht."); router.refresh(); }
          else toast.error(r.message);
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
