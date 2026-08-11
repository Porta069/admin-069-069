import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import { CircleDot } from "lucide-react";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string | null;
  actor?: string | null;
  timestamp: string | Date;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}

const TONE: Record<NonNullable<TimelineEvent["tone"]>, string> = {
  default: "bg-card text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  if (events.length === 0) return null;
  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((event, i) => {
        const Icon = event.icon ?? CircleDot;
        return (
          <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span
                className="absolute top-7 left-3.25 h-full w-px bg-border"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-full border",
                TONE[event.tone ?? "default"],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium">{event.title}</p>
                <time className="text-xs whitespace-nowrap text-muted-foreground tabular">
                  {formatDateTime(event.timestamp)}
                </time>
              </div>
              {event.description && (
                <p className="mt-0.5 text-sm break-words text-muted-foreground">
                  {event.description}
                </p>
              )}
              {event.actor && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {event.actor}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
