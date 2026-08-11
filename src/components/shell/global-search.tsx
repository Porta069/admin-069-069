"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Building2,
  FileText,
  Loader2,
  Search,
  StickyNote,
  UserSquare2,
} from "lucide-react";

interface SearchResult {
  type: "candidate" | "company" | "job" | "application" | "note";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

const GROUP_META: Record<
  SearchResult["type"],
  { label: string; icon: React.ElementType }
> = {
  candidate: { label: "Kandidaten", icon: UserSquare2 },
  company: { label: "Unternehmen", icon: Building2 },
  job: { label: "Stellenanzeigen", icon: Briefcase },
  application: { label: "Bewerbungen", icon: FileText },
  note: { label: "Notizen", icon: StickyNote },
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results);
        }
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  const grouped = results.reduce<Map<SearchResult["type"], SearchResult[]>>(
    (acc, r) => {
      const list = acc.get(r.type) ?? [];
      list.push(r);
      acc.set(r.type, list);
      return acc;
    },
    new Map(),
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8.5 w-64 justify-start gap-2 bg-card px-2.5 font-normal text-muted-foreground"
      >
        <Search className="size-4" />
        Global suchen…
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        title="Globale Suche"
        description="Kandidaten, Unternehmen, Stellen, Bewerbungen und Notizen durchsuchen"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Name, Unternehmen, Stelle, E-Mail…"
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <CommandEmpty>Keine Treffer für „{query}“</CommandEmpty>
          )}
          {[...grouped.entries()].map(([type, items]) => {
            const meta = GROUP_META[type];
            return (
              <CommandGroup key={type} heading={meta.label}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type}-${item.id}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <meta.icon className="size-4 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                    {item.subtitle && (
                      <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
