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
  Send,
  StickyNote,
  UserPlus,
  UserSearch,
  UserSquare2,
  CornerDownLeft,
} from "lucide-react";
import { NAV_GROUPS } from "./nav-config";

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

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

// Schnell-Aktionen (Sprünge zu Anlege-Flows).
const ACTIONS = [
  { href: "/mitarbeiter/neu", label: "Neuer Mitarbeiter", icon: UserPlus },
  { href: "/kandidaten-suche", label: "Kandidaten suchen", icon: UserSearch },
  { href: "/vorschlaege", label: "Vorschlag / Angebot erstellen", icon: Send },
];

export function GlobalSearch({ allowedHrefs }: { allowedHrefs: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  const allowed = React.useMemo(() => new Set(allowedHrefs), [allowedHrefs]);
  const navItems = React.useMemo(
    () => NAV_ITEMS.filter((i) => allowed.has(i.href)),
    [allowed],
  );
  const actionItems = React.useMemo(
    () => ACTIONS.filter((a) => allowed.has(a.href)),
    [allowed],
  );

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

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const grouped = results.reduce<Map<SearchResult["type"], SearchResult[]>>(
    (acc, r) => {
      const list = acc.get(r.type) ?? [];
      list.push(r);
      acc.set(r.type, list);
      return acc;
    },
    new Map(),
  );

  const q = query.trim().toLowerCase();
  const filteredNav = q
    ? navItems.filter((i) => i.label.toLowerCase().includes(q))
    : navItems;
  const filteredActions = q
    ? actionItems.filter((a) => a.label.toLowerCase().includes(q))
    : actionItems;

  const nichts =
    q.length >= 2 &&
    !loading &&
    results.length === 0 &&
    filteredNav.length === 0 &&
    filteredActions.length === 0;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8.5 w-64 justify-start gap-2 bg-card px-2.5 font-normal text-muted-foreground"
      >
        <Search className="size-4" />
        Suchen · Springen…
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        title="Command-Palette"
        description="Suchen, zu jeder Seite springen oder eine Aktion ausführen"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Suchen oder springen — Name, Seite, Aktion…"
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Entity-Treffer (ab 2 Zeichen) */}
          {[...grouped.entries()].map(([type, items]) => {
            const meta = GROUP_META[type];
            return (
              <CommandGroup key={type} heading={meta.label}>
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`res-${item.type}-${item.id}`}
                    onSelect={() => go(item.href)}
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

          {filteredActions.length > 0 && (
            <CommandGroup heading="Aktionen">
              {filteredActions.map((a) => (
                <CommandItem key={a.href} value={`act-${a.href}`} onSelect={() => go(a.href)}>
                  <a.icon className="size-4 text-primary" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredNav.length > 0 && (
            <CommandGroup heading="Navigation">
              {filteredNav.map((n) => (
                <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                  <n.icon className="size-4 text-muted-foreground" />
                  <span>{n.label}</span>
                  <CornerDownLeft className="ml-auto size-3.5 text-muted-foreground/40" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {nichts && <CommandEmpty>Keine Treffer für „{query}“</CommandEmpty>}
        </CommandList>
      </CommandDialog>
    </>
  );
}
