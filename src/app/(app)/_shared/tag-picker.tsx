"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addTagToEntity,
  listTags,
  removeTagFromEntity,
  type Tag,
  type TagEntityType,
} from "./tag-actions";

/** 8 kuratierte Tag-Farben (Workbench-Palette, Orange zuerst). */
const TAG_COLORS = [
  "#ea580c", // Orange (Akzent)
  "#dc2626", // Rot
  "#ca8a04", // Ocker
  "#16a34a", // Grün
  "#0d9488", // Petrol
  "#2563eb", // Blau
  "#7c3aed", // Violett
  "#64748b", // Schiefer
];

const FALLBACK_COLOR = "#64748b";

function TagChip({
  tag,
  onRemove,
  removing,
}: {
  tag: Tag;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const color = tag.color ?? FALLBACK_COLOR;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2 text-xs font-medium"
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
    >
      {tag.name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Tag „${tag.name}“ entfernen`}
          className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30"
        >
          {removing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <X className="size-3" />
          )}
        </button>
      ) : (
        <span className="w-0.5" aria-hidden />
      )}
    </span>
  );
}

/**
 * Tags eines Datensatzes als farbige Chips + Popover zum Suchen,
 * Auswählen oder Anlegen neuer Tags (mit Farbwahl).
 */
export function TagPicker({
  entityType,
  entityId,
  initialTags,
  canEdit = true,
}: {
  entityType: TagEntityType;
  entityId: string;
  initialTags: Tag[];
  canEdit?: boolean;
}) {
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [allTags, setAllTags] = React.useState<Tag[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [color, setColor] = React.useState<string>(TAG_COLORS[0]);
  const [pending, startTransition] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const loadAll = React.useCallback(() => {
    if (allTags !== null) return;
    void listTags().then((result) => {
      if (result.ok) setAllTags(result.tags);
    });
  }, [allTags]);

  const add = (name: string, withColor?: string) => {
    startTransition(async () => {
      const result = await addTagToEntity(entityType, entityId, name, withColor);
      if (result.ok) {
        setTags((prev) =>
          prev.some((t) => t.id === result.tag.id) ? prev : [...prev, result.tag],
        );
        setAllTags((prev) =>
          prev && !prev.some((t) => t.id === result.tag.id)
            ? [...prev, result.tag].sort((a, b) => a.name.localeCompare(b.name, "de"))
            : prev,
        );
        setQuery("");
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  const remove = (tag: Tag) => {
    setRemovingId(tag.id);
    startTransition(async () => {
      const result = await removeTagFromEntity(entityType, entityId, tag.id);
      if (result.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
      } else {
        toast.error(result.message);
      }
      setRemovingId(null);
    });
  };

  const normalized = query.trim().toLowerCase();
  const assignedIds = new Set(tags.map((t) => t.id));
  const suggestions = (allTags ?? []).filter((t) => !assignedIds.has(t.id));
  const exactExists = (allTags ?? []).some((t) => t.name === normalized);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          onRemove={canEdit ? () => remove(tag) : undefined}
          removing={removingId === tag.id}
        />
      ))}
      {canEdit && (
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) loadAll();
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="rounded-full border-dashed text-muted-foreground"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Tag suchen oder anlegen…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {allTags === null ? "Lade Tags…" : "Keine Tags vorhanden."}
                </CommandEmpty>
                <CommandGroup>
                  {suggestions
                    .filter((t) => !normalized || t.name.includes(normalized))
                    .slice(0, 8)
                    .map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        disabled={pending}
                        onSelect={() => add(tag.name)}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: tag.color ?? FALLBACK_COLOR,
                          }}
                          aria-hidden
                        />
                        <span className="truncate">{tag.name}</span>
                      </CommandItem>
                    ))}
                  {normalized && !exactExists && (
                    <CommandItem
                      value={`neu-${normalized}`}
                      disabled={pending}
                      onSelect={() => add(normalized, color)}
                    >
                      <TagIcon className="size-3.5 text-muted-foreground" />
                      <span className="truncate">„{normalized}“ anlegen</span>
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
              <div className="border-t px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Farbe für neue Tags
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Farbe ${c} wählen`}
                      onClick={() => setColor(c)}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full transition-transform hover:scale-110",
                        color === c && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="size-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {!canEdit && tags.length === 0 && (
        <span className="text-xs text-muted-foreground">Keine Tags</span>
      )}
    </div>
  );
}
