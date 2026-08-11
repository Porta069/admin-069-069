"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteViewAction,
  listViewsAction,
  saveViewAction,
  type SavedViewItem,
} from "./view-actions";
import { Bookmark, BookmarkPlus, Loader2, Trash2 } from "lucide-react";

/** Gespeicherte Ansichten: aktuelle Filter/Sortierung unter Namen sichern. */
export function SavedViews({ module }: { module: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = React.useState<SavedViewItem[] | null>(null);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    setViews(await listViewsAction(module).catch(() => []));
  }, [module]);

  const currentQuery = searchParams.toString();

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && views === null && load()}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 bg-card">
            <Bookmark className="size-4" />
            Ansichten
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Gespeicherte Ansichten</DropdownMenuLabel>
          {views === null ? (
            <div className="flex justify-center py-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : views.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Noch keine Ansichten gespeichert.
            </p>
          ) : (
            views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                className="group"
                onSelect={() => {
                  router.replace(
                    view.query ? `${pathname}?${view.query}` : pathname,
                    { scroll: false },
                  );
                }}
              >
                <span className="truncate">{view.name}</span>
                <button
                  className="ml-auto hidden rounded p-0.5 text-muted-foreground group-hover:block hover:text-destructive"
                  aria-label={`Ansicht ${view.name} löschen`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const result = await deleteViewAction(view.id);
                    if (result.ok) {
                      setViews((prev) => prev?.filter((v) => v.id !== view.id) ?? null);
                    } else toast.error(result.message);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaveOpen(true)}>
            <BookmarkPlus className="size-4" />
            Aktuelle Ansicht speichern…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ansicht speichern</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const result = await saveViewAction(module, name, currentQuery);
              setPending(false);
              if (result.ok) {
                toast.success(`Ansicht „${name}" gespeichert`);
                setSaveOpen(false);
                setName("");
                setViews(null);
              } else toast.error(result.message);
            }}
            className="space-y-4"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='z. B. „Offene Kandidaten in BW"'
              autoFocus
              required
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Speichert Suchbegriff, Filter, Sortierung und Seite dieser Tabelle.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
