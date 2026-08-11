"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { deleteNote, toggleNotePin, updateNote } from "../actions";

export function NoteCardActions({
  noteId,
  content,
  category,
  pinned,
  categories,
  canEdit,
  canDelete,
}: {
  noteId: string;
  content: string;
  category: string;
  pinned: boolean;
  categories: string[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [draftContent, setDraftContent] = React.useState(content);
  const [draftCategory, setDraftCategory] = React.useState(category);

  if (!canEdit && !canDelete) return null;

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Aktion fehlgeschlagen");
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Notiz-Aktionen"
            disabled={pending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEdit && (
            <>
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => toggleNotePin(noteId, !pinned),
                    pinned ? "Notiz entpinnt" : "Notiz angepinnt",
                  )
                }
              >
                {pinned ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
                {pinned ? "Entpinnen" : "Anpinnen"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDraftContent(content);
                  setDraftCategory(category);
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-4" />
                Bearbeiten
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <>
              {canEdit && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => run(() => deleteNote(noteId), "Notiz gelöscht")}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notiz bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-note-${noteId}`}>Inhalt</Label>
              <Textarea
                id={`edit-note-${noteId}`}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategorie</Label>
              <Select value={draftCategory} onValueChange={setDraftCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(categories.includes(draftCategory)
                    ? categories
                    : [draftCategory, ...categories]
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateNote({
                      id: noteId,
                      content: draftContent,
                      category: draftCategory,
                    }),
                  "Notiz gespeichert",
                )
              }
            >
              {pending ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
