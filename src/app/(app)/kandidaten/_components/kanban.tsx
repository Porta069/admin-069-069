"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { MapPin } from "lucide-react";

export interface KanbanCardData {
  id: string;
  name: string;
  profession: string | null;
  federalState: string | null;
  priority: string;
  assigneeName: string | null;
  assigneeColor: string | null;
}

export interface KanbanColumnData {
  status: string;
  count: number;
  cards: KanbanCardData[];
}

type ActionResult = { ok: boolean; message?: string };

export function CandidateKanban({
  columns: initial,
  action,
  canEdit,
}: {
  columns: KanbanColumnData[];
  action: (id: string, status: string | null) => Promise<ActionResult>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  // Server-Refresh übernimmt die neuen Daten (Pattern: state aus Props ableiten).
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setColumns(initial);
  }

  const moveCard = (
    cols: KanbanColumnData[],
    cardId: string,
    from: string,
    to: string,
  ): KanbanColumnData[] => {
    const card = cols
      .find((c) => c.status === from)
      ?.cards.find((c) => c.id === cardId);
    if (!card) return cols;
    return cols.map((col) => {
      if (col.status === from) {
        return {
          ...col,
          count: Math.max(0, col.count - 1),
          cards: col.cards.filter((c) => c.id !== cardId),
        };
      }
      if (col.status === to) {
        return { ...col, count: col.count + 1, cards: [card, ...col.cards] };
      }
      return col;
    });
  };

  const handleDrop = (target: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    if (!canEdit) return;
    let payload: { id: string; from: string };
    try {
      payload = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (!payload?.id || payload.from === target) return;

    const previous = columns;
    setColumns((cols) => moveCard(cols, payload.id, payload.from, target));
    startTransition(async () => {
      const result = await action(payload.id, target).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Status aktualisiert.");
        router.refresh();
      } else {
        setColumns(previous);
        toast.error(result.message ?? "Status konnte nicht geändert werden.");
      }
    });
  };

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
      {columns.map((col) => (
        <section
          key={col.status}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(col.status);
          }}
          onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
          onDrop={(e) => handleDrop(col.status, e)}
          className={cn(
            "flex max-h-[calc(100dvh-16rem)] w-66 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors",
            dragOver === col.status && "border-primary/50 bg-accent",
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <StatusBadge map={CANDIDATE_STATUS} value={col.status} />
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
              {col.count}
            </span>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {col.cards.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
                Keine Kandidaten
              </p>
            ) : (
              col.cards.map((card) => (
                <article
                  key={card.id}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({ id: card.id, from: col.status }),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={cn(
                    "rounded-md border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm",
                    canEdit && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <Link
                    href={`/kandidaten/${card.id}`}
                    className="text-sm font-medium hover:text-primary"
                    draggable={false}
                  >
                    {card.name}
                  </Link>
                  {card.profession && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {card.profession}
                    </p>
                  )}
                  {card.federalState && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                      <MapPin className="size-3" />
                      {card.federalState}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between">
                    <PriorityBadge value={card.priority} />
                    <EmployeeAvatar
                      name={card.assigneeName}
                      color={card.assigneeColor}
                      size="sm"
                    />
                  </div>
                </article>
              ))
            )}
            {col.count > col.cards.length && (
              <p className="px-2 pb-1 text-center text-[11px] text-muted-foreground/70">
                + {col.count - col.cards.length} weitere in der Tabellen-Ansicht
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
