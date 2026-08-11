"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createNote } from "../actions";

export interface LinkOption {
  id: string;
  label: string;
}

const NONE = "__none__";
const NEW_CATEGORY = "__new__";

export function NoteCreateDialog({
  categories,
  candidates,
  companies,
  canManage,
  initialOpen = false,
}: {
  categories: string[];
  candidates: LinkOption[];
  companies: LinkOption[];
  canManage: boolean;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, startTransition] = React.useTransition();

  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState(categories[0] ?? "ALLGEMEIN");
  const [newCategory, setNewCategory] = React.useState("");
  const [link, setLink] = React.useState(NONE);
  const [pinned, setPinned] = React.useState(false);

  const submit = () => {
    if (!content.trim()) {
      toast.error("Bitte einen Inhalt angeben.");
      return;
    }
    const effectiveCategory =
      category === NEW_CATEGORY ? newCategory.trim() : category;
    if (!effectiveCategory) {
      toast.error("Bitte eine Kategorie wählen.");
      return;
    }
    const [entityType, entityId] =
      link === NONE ? ["", ""] : (link.split(":") as [string, string]);
    startTransition(async () => {
      const result = await createNote({
        content,
        category: effectiveCategory,
        entityType,
        entityId,
        pinned,
      });
      if (result.ok) {
        toast.success("Notiz erstellt");
        setContent("");
        setNewCategory("");
        setLink(NONE);
        setPinned(false);
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
          Notiz erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notiz erstellen</DialogTitle>
          <DialogDescription>
            Wissen festhalten und optional mit einem Datensatz verknüpfen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="note-content">Inhalt</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Was gibt es festzuhalten?"
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  {canManage && (
                    <SelectItem value={NEW_CATEGORY}>
                      + Neue Kategorie…
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Verknüpfung</Label>
              <Select value={link} onValueChange={setLink}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Keine Verknüpfung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine Verknüpfung</SelectItem>
                  {candidates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Kandidaten</SelectLabel>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={`candidate:${c.id}`}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {companies.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Unternehmen</SelectLabel>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={`company:${c.id}`}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {category === NEW_CATEGORY && canManage && (
            <div className="grid gap-1.5">
              <Label htmlFor="note-new-cat">Neue Kategorie</Label>
              <Input
                id="note-new-cat"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="z. B. FOLLOW_UP"
                maxLength={60}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={pinned}
              onCheckedChange={(c) => setPinned(c === true)}
            />
            Notiz anpinnen
          </label>
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
