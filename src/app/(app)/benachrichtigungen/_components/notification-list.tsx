"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  CheckCheck,
  FileText,
  Gift,
  Handshake,
  ListTodo,
  Loader2,
  MessageSquare,
  Settings,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { acknowledgeNotification, acknowledgeAll, undoAcknowledge } from "../actions";

export interface NotificationTagChip {
  label: string;
  href: string | null;
  entityType: string;
}

export interface NotificationItem {
  id: string;
  type: string | null;
  kategorie: string;
  title: string;
  body: string | null;
  priority: string | null;
  sender: string | null;
  createdAt: string;
  href: string | null;
  tags?: NotificationTagChip[];
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  NEW_CANDIDATE: UserSquare2,
  NEW_APPLICATION: FileText,
  NEW_JOB: Briefcase,
  REFERRAL_EVENT: Gift,
  APPOINTMENT_REMINDER: CalendarDays,
  ASSIGNMENT: UserSquare2,
  PERSOENLICH: MessageSquare,
};

function iconForType(type: string | null, kategorie: string): LucideIcon {
  if (kategorie === "PERSOENLICH") return MessageSquare;
  if (kategorie === "SYSTEM") return Settings;
  if (type && TYPE_ICONS[type]) return TYPE_ICONS[type];
  const t = (type ?? "").toLowerCase();
  if (t.includes("task") || t.includes("aufgabe")) return ListTodo;
  if (t.includes("candidate") || t.includes("kandidat")) return UserSquare2;
  if (t.includes("application") || t.includes("bewerbung")) return FileText;
  if (t.includes("job") || t.includes("stelle")) return Briefcase;
  if (t.includes("placement") || t.includes("vermittlung")) return Handshake;
  if (t.includes("referral") || t.includes("empfehlung")) return Gift;
  if (t.includes("termin") || t.includes("appointment") || t.includes("interview"))
    return CalendarDays;
  return Bell;
}

const PRIORITY_DOT: Record<string, string> = {
  DRINGEND: "bg-destructive",
  HOCH: "bg-warning",
  NORMAL: "bg-muted-foreground/40",
  NIEDRIG: "bg-muted-foreground/20",
};

/** Alle offenen Mitteilungen einer Kategorie wahrnehmen. */
export function AcknowledgeAllButton({
  kategorie,
  disabled,
}: {
  kategorie?: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      className="bg-card"
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);
        const result = await acknowledgeAll(kategorie);
        setPending(false);
        if (result.ok) {
          toast.success(
            result.count > 0
              ? `${result.count} wahrgenommen`
              : "Nichts Offenes",
          );
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
      Alle wahrnehmen
    </Button>
  );
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  // Optimistisch ausgeblendete (wahrgenommene) IDs — bis Undo oder Refresh.
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  const wahrnehmen = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingId) return;
    setPendingId(item.id);
    const result = await acknowledgeNotification(item.id);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setHidden((prev) => new Set(prev).add(item.id));
    // 30 Sekunden Undo-Fenster; danach räumt der Sweeper die Zeile endgültig.
    toast.success("Wahrgenommen", {
      duration: 30000,
      action: {
        label: "Rückgängig",
        onClick: async () => {
          const undo = await undoAcknowledge(item.id);
          if (undo.ok) {
            setHidden((prev) => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
            router.refresh();
          } else {
            toast.error(undo.message);
          }
        },
      },
    });
  };

  const sichtbar = items.filter((i) => !hidden.has(i.id));

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {sichtbar.map((item) => {
        const Icon = iconForType(item.type, item.kategorie);
        const clickable = Boolean(item.href);
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 transition-colors",
              clickable && "cursor-pointer hover:bg-muted/50",
            )}
            onClick={clickable ? () => router.push(item.href!) : undefined}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon className="size-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      PRIORITY_DOT[item.priority ?? "NORMAL"] ?? PRIORITY_DOT.NORMAL,
                    )}
                    title={`Priorität: ${item.priority ?? "NORMAL"}`}
                  />
                  {formatRelative(item.createdAt)}
                </span>
              </div>
              {item.sender && (
                <span className="text-xs text-muted-foreground">von {item.sender}</span>
              )}
              {item.body && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.tags.map((t, i) =>
                    t.href ? (
                      <a
                        key={i}
                        href={t.href}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-accent"
                      >
                        {t.entityType === "candidate" ? (
                          <UserSquare2 className="size-3" />
                        ) : (
                          <Briefcase className="size-3" />
                        )}
                        {t.label}
                      </a>
                    ) : (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t.label}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-success"
              aria-label="Wahrnehmen"
              title="Als wahrgenommen markieren"
              disabled={pendingId === item.id}
              onClick={(e) => wahrnehmen(item, e)}
            >
              {pendingId === item.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
