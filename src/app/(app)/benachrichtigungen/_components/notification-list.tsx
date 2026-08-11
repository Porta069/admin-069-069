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
  CheckCheck,
  FileText,
  Gift,
  Handshake,
  ListTodo,
  Loader2,
  Settings,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead } from "../actions";

export interface NotificationItem {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  priority: string | null;
  read: boolean;
  createdAt: string;
  href: string | null;
}

/** Feste Sync-/Automation-Typen mit eindeutigem Icon. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  NEW_CANDIDATE: UserSquare2,
  NEW_APPLICATION: FileText,
  NEW_JOB: Briefcase,
  REFERRAL_EVENT: Gift,
  APPOINTMENT_REMINDER: CalendarDays,
};

function iconForType(type: string | null): LucideIcon {
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
  if (t.includes("system")) return Settings;
  return Bell;
}

const PRIORITY_DOT: Record<string, string> = {
  DRINGEND: "bg-destructive",
  HOCH: "bg-warning",
  NORMAL: "bg-muted-foreground/40",
  NIEDRIG: "bg-muted-foreground/20",
};

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      className="bg-card"
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);
        const result = await markAllNotificationsRead();
        setPending(false);
        if (result.ok) {
          toast.success(
            result.count > 0
              ? `${result.count} Benachrichtigungen als gelesen markiert`
              : "Alles bereits gelesen",
          );
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCheck className="size-4" />
      )}
      Alle als gelesen markieren
    </Button>
  );
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const open = async (item: NotificationItem) => {
    if (pendingId) return;
    if (!item.read) {
      setPendingId(item.id);
      const result = await markNotificationRead(item.id);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    }
    if (item.href) {
      router.push(item.href);
    } else {
      router.refresh();
    }
  };

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {items.map((item) => {
        const Icon = iconForType(item.type);
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50",
                !item.read && "bg-accent/40",
              )}
            >
              <span className="flex w-3 shrink-0 justify-center pt-2">
                {!item.read && (
                  <span
                    className="size-2 rounded-full bg-primary"
                    aria-label="Ungelesen"
                  />
                )}
              </span>
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                  item.read ? "bg-muted" : "bg-primary/10",
                )}
              >
                {pendingId === item.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Icon
                    className={cn(
                      "size-4",
                      item.read ? "text-muted-foreground" : "text-primary",
                    )}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "truncate text-sm",
                      item.read ? "font-medium" : "font-semibold",
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        PRIORITY_DOT[item.priority ?? "NORMAL"] ??
                          PRIORITY_DOT.NORMAL,
                      )}
                      title={`Priorität: ${item.priority ?? "NORMAL"}`}
                    />
                    {formatRelative(item.createdAt)}
                  </span>
                </span>
                {item.body && (
                  <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                    {item.body}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
