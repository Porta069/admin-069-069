"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarClock, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { formatDate } from "@/lib/format";
import { LEAD_STATUS } from "../lead-defs";
import { updateLeadStatus } from "../actions";
import { LeadDetail, type Lead } from "./lead-detail";

export interface LeadColumn {
  status: string;
  count: number;
  cards: Lead[];
}

/**
 * Pipeline-Board der Unternehmens-Anwerbung: Spalten je Status, Karten per
 * Drag & Drop in die nächste Stufe ziehen (optimistisch, mit Rollback). Klick auf
 * eine Karte öffnet den Detail-Dialog (Termin/Vertrag/Übernahme).
 */
export function LeadBoard({
  columns: initial,
  canEdit,
}: {
  columns: LeadColumn[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = React.useState(initial);
  const [prevInitial, setPrevInitial] = React.useState(initial);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setColumns(initial);
  }

  const moveCard = (
    cols: LeadColumn[],
    cardId: string,
    from: string,
    to: string,
  ): LeadColumn[] => {
    const card = cols.find((c) => c.status === from)?.cards.find((c) => c.id === cardId);
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
        return { ...col, count: col.count + 1, cards: [{ ...card, status: to }, ...col.cards] };
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
      const result = await updateLeadStatus(payload.id, target).catch(() => ({
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
            "flex max-h-[calc(100dvh-18rem)] w-64 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors",
            dragOver === col.status && "border-primary/50 bg-accent",
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <StatusBadge map={LEAD_STATUS} value={col.status} />
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
              {col.count}
            </span>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {col.cards.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
                Keine Leads
              </p>
            ) : (
              col.cards.map((card) => (
                <LeadDetail key={card.id} lead={card} canEdit={canEdit}>
                  <article
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
                      canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    )}
                  >
                    <p className="text-sm font-medium">{card.name}</p>
                    {card.ansprechpartner && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {card.ansprechpartner}
                      </p>
                    )}
                    {card.ort && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                        <MapPin className="size-3" />
                        {card.ort}
                      </p>
                    )}
                    {card.termin_at && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                        <CalendarClock className="size-3" />
                        {formatDate(card.termin_at)}
                      </p>
                    )}
                    <div className="mt-2.5 flex items-center justify-end">
                      <EmployeeAvatar
                        name={card.assignee_name}
                        color={card.assignee_color}
                        size="sm"
                      />
                    </div>
                  </article>
                </LeadDetail>
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
