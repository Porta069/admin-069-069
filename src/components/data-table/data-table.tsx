"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  /** Hidden by default; user can enable it via the column picker. */
  defaultHidden?: boolean;
}

export interface DataTableRow {
  id: string;
  /** Row click navigates here (cells with their own links still win). */
  href?: string;
  cells: Record<string, React.ReactNode>;
}

export interface BulkAction {
  label: string;
  /** Server action — runs with the selected row ids. */
  action: (ids: string[]) => Promise<{ ok: boolean; message?: string }>;
  destructive?: boolean;
}

export function DataTable({
  tableId,
  columns,
  rows,
  total,
  page,
  pageSize,
  searchPlaceholder = "Suchen…",
  emptyTitle = "Keine Einträge gefunden",
  emptyDescription,
  bulkActions,
  toolbar,
}: {
  /** Stable id — column visibility is persisted per table in localStorage. */
  tableId: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  total: number;
  page: number;
  pageSize: number;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  bulkActions?: BulkAction[];
  /** Extra filters rendered next to the search box. */
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`pw-cols-${tableId}`);
      if (stored) setHidden(new Set(JSON.parse(stored)));
    } catch {
      /* ignore */
    }
  }, [tableId]);

  const persistHidden = (next: Set<string>) => {
    setHidden(next);
    try {
      localStorage.setItem(`pw-cols-${tableId}`, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const setParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounced search → URL (?q=)
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => setParams({ q: search, page: null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const sortKey = searchParams.get("sort");
  const sortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setParams({ dir: sortDir === "desc" ? "asc" : "desc", page: null });
    } else {
      setParams({ sort: key, dir: "desc", page: null });
    }
  };

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const runBulk = async (bulk: BulkAction) => {
    const ids = [...selected];
    const result = await bulk.action(ids).catch((e: Error) => ({
      ok: false as const,
      message: e.message,
    }));
    if (result.ok) {
      toast.success(result.message ?? `${ids.length} Einträge aktualisiert`);
      setSelected(new Set());
      router.refresh();
    } else {
      toast.error(result.message ?? "Aktion fehlgeschlagen");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-64 bg-card pl-8"
          />
        </div>
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          {isPending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 bg-card">
                <SlidersHorizontal className="size-4" />
                Spalten
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={!hidden.has(col.key)}
                  onCheckedChange={(checked) => {
                    const next = new Set(hidden);
                    if (checked) next.delete(col.key);
                    else next.add(col.key);
                    persistHidden(next);
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selected.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            {selected.size} ausgewählt
          </span>
          <div className="ml-auto flex gap-2">
            {bulkActions.map((bulk) => (
              <Button
                key={bulk.label}
                size="sm"
                variant={bulk.destructive ? "destructive" : "outline"}
                className={cn(!bulk.destructive && "bg-card")}
                onClick={() => runBulk(bulk)}
              >
                {bulk.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {bulkActions && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      setSelected(
                        checked ? new Set(rows.map((r) => r.id)) : new Set(),
                      );
                    }}
                    aria-label="Alle auswählen"
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (bulkActions ? 1 : 0)}
                  className="p-0"
                >
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(row.href && "cursor-pointer")}
                  onClick={(e) => {
                    if (!row.href) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("a,button,[role=checkbox],[role=menuitem]"))
                      return;
                    router.push(row.href);
                  }}
                >
                  {bulkActions && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected);
                          if (checked) next.add(row.id);
                          else next.delete(row.id);
                          setSelected(next);
                        }}
                        aria-label="Zeile auswählen"
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {row.cells[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular">
          {total === 0
            ? "0 Einträge"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} von ${total.toLocaleString("de-DE")}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8 bg-card"
            disabled={page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 tabular">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8 bg-card"
            disabled={page >= pageCount}
            onClick={() => setParams({ page: String(page + 1) })}
            aria-label="Nächste Seite"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
