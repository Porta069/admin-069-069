"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { PresenceBadge } from "@/components/common/presence-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoveRight, GripVertical } from "lucide-react";

export interface BoardCard {
  id: string;
  name: string;
  subtitle: string | null;
  status: string | null;
  assigneeId: string | null;
}

export interface BoardColumn {
  employeeId: string | null; // null = ohne Zuständigen
  name: string;
  avatarColor: string | null;
  avatarUrl: string | null;
  presence: string | null;
  lastSeenAt: string | null;
}

type MoveAction = (
  cardId: string,
  assigneeId: string | null,
) => Promise<{ ok: boolean; message?: string }>;

export function VerteilungBoard({
  columns,
  initialCards,
  moveAction,
  hrefBase,
  entityLabel,
}: {
  columns: BoardColumn[];
  initialCards: BoardCard[];
  moveAction: MoveAction;
  hrefBase: string; // z. B. "/kandidaten/"
  entityLabel: string; // "Kandidaten" | "Unternehmen"
}) {
  const router = useRouter();
  const [cards, setCards] = React.useState<BoardCard[]>(initialCards);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => setCards(initialCards), [initialCards]);

  const spalten = React.useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const col of columns) map.set(col.employeeId ?? "__none__", []);
    for (const c of cards) {
      const key = c.assigneeId ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [cards, columns]);

  const verschieben = async (cardId: string, ziel: string | null) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.assigneeId === ziel) return;
    const vorher = card.assigneeId;
    // Optimistisch verschieben.
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, assigneeId: ziel } : c)),
    );
    setPending(cardId);
    const res = await moveAction(cardId, ziel);
    setPending(null);
    if (res.ok) {
      const zielName = columns.find((c) => c.employeeId === ziel)?.name ?? "Ohne Zuständigen";
      toast.success(`${card.name} → ${zielName}`);
      router.refresh();
    } else {
      // Rollback.
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, assigneeId: vorher } : c)),
      );
      toast.error(res.message ?? "Verschieben fehlgeschlagen.");
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const key = col.employeeId ?? "__none__";
        const list = spalten.get(key) ?? [];
        const istOhne = col.employeeId === null;
        return (
          <section
            key={key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(key);
            }}
            onDragLeave={() => setOverCol((c) => (c === key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragId) verschieben(dragId, col.employeeId);
              setDragId(null);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-card",
              overCol === key && "ring-2 ring-primary",
              istOhne && "border-dashed",
            )}
          >
            <header className="flex items-center gap-2.5 border-b px-3 py-2.5">
              {istOhne ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MoveRight className="size-4" />
                </span>
              ) : (
                <span className="relative inline-flex">
                  <EmployeeAvatar name={col.name} color={col.avatarColor} imageUrl={col.avatarUrl} size="sm" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{col.name}</span>
                {!istOhne && (
                  <PresenceBadge presence={col.presence} lastSeenAt={col.lastSeenAt} withLabel />
                )}
              </span>
              <span className="rounded-full bg-muted px-2 text-xs tabular text-muted-foreground">
                {list.length}
              </span>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "62vh" }}>
              {list.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  {istOhne ? "Alles zugeordnet" : `Keine ${entityLabel}`}
                </p>
              ) : (
                list.map((card) => (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "group rounded-md border bg-background p-2.5 text-sm transition-shadow hover:shadow-sm",
                      pending === card.id && "opacity-50",
                      dragId === card.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground/40" />
                      <div className="min-w-0 flex-1">
                        <Link href={`${hrefBase}${card.id}`} className="block truncate font-medium hover:underline">
                          {card.name}
                        </Link>
                        {card.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{card.subtitle}</p>
                        )}
                        {card.status && (
                          <span className="mt-1.5 inline-flex">
                            <StatusBadge map={CANDIDATE_STATUS} value={card.status} />
                          </span>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100"
                            aria-label="Verschieben nach…"
                            title="Verschieben nach…"
                          >
                            <MoveRight className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="max-h-72 w-52 overflow-y-auto">
                          <DropdownMenuLabel>Verschieben nach…</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {columns
                            .filter((c) => c.employeeId !== card.assigneeId)
                            .map((c) => (
                              <DropdownMenuItem
                                key={c.employeeId ?? "__none__"}
                                onClick={() => verschieben(card.id, c.employeeId)}
                              >
                                {c.name}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
