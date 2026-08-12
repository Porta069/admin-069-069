"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import {
  ENTITY_LABELS,
  TASK_STATUS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { formatDate, formatTime } from "@/lib/format";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ListTodo,
  User,
} from "lucide-react";
import { completeTask } from "../actions";

export interface TaskData {
  id: string;
  title: string;
  dueAt: string;
  hasTime: boolean;
  priority: string;
  status: string;
  assigneeName: string | null;
  assigneeColor: string | null;
  entityType: string | null;
  entityId: string | null;
  overdue: boolean;
}

/**
 * Aufgabe im Kalender — bewusst anders als Termine: outline-Chip mit
 * gestricheltem Rand + ListTodo-Icon statt gefüllter Terminfläche.
 */
export function TaskItem({
  task,
  variant,
  canComplete,
  className,
}: {
  task: TaskData;
  variant: "chip" | "row";
  canComplete: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const closed = task.status === "DONE" || task.status === "CANCELLED";
  const accent = task.assigneeColor ?? "var(--primary)";

  const complete = () =>
    startTransition(async () => {
      const result = await completeTask(task.id);
      if (result.ok) {
        toast.success("Aufgabe als erledigt markiert");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  const trigger =
    variant === "chip" ? (
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-center gap-1 rounded border border-dashed bg-card px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors hover:bg-accent",
          closed
            ? "text-muted-foreground/70 line-through"
            : task.overdue
              ? "border-destructive/60 text-destructive"
              : "text-foreground/85",
          className,
        )}
        style={
          closed
            ? undefined
            : { borderLeftWidth: 2, borderLeftColor: task.overdue ? undefined : accent }
        }
      >
        <ListTodo
          className="size-3 shrink-0"
          style={
            closed || task.overdue ? undefined : { color: accent }
          }
        />
        <span className="truncate">
          {task.hasTime && (
            <span className="tabular">{formatTime(task.dueAt)} </span>
          )}
          {task.title}
        </span>
      </button>
    ) : (
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent",
          className,
        )}
      >
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            task.overdue && !closed && "bg-destructive",
          )}
          style={
            task.overdue && !closed
              ? undefined
              : { backgroundColor: accent }
          }
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              closed && "text-muted-foreground line-through",
            )}
          >
            <ListTodo className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{task.title}</span>
          </span>
          <span
            className={cn(
              "block text-xs tabular",
              task.overdue && !closed
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {task.overdue && !closed ? "Überfällig · " : "Fällig: "}
            {formatDate(task.dueAt)}
            {task.hasTime && ` · ${formatTime(task.dueAt)} Uhr`}
          </span>
        </span>
      </button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b px-3 py-2.5">
          <p
            className={cn(
              "text-sm font-semibold",
              closed && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge map={TASK_STATUS} value={task.status} />
            <PriorityBadge value={task.priority} />
            {task.overdue && !closed && (
              <Badge variant="destructive">Überfällig</Badge>
            )}
          </div>
        </div>
        <div className="space-y-1.5 px-3 py-2.5 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="size-4 shrink-0" />
            <span
              className={cn(
                "tabular",
                task.overdue && !closed && "font-medium text-destructive",
              )}
            >
              Fällig am {formatDate(task.dueAt)}
              {task.hasTime && `, ${formatTime(task.dueAt)} Uhr`}
            </span>
          </p>
          {task.assigneeName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4 shrink-0" />
              {task.assigneeName}
            </p>
          )}
          {task.entityType && task.entityId && (
            <Link
              href={entityHref(task.entityType as EntityType, task.entityId)}
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-accent">
                {ENTITY_LABELS[task.entityType as EntityType] ??
                  task.entityType}
              </Badge>
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5">
          <Link
            href="/aufgaben"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Zur Aufgabenliste
            <ArrowRight className="size-3" />
          </Link>
          {canComplete && !closed && (
            <Button size="sm" disabled={pending} onClick={complete}>
              <Check className="size-4" />
              {pending ? "Wird gespeichert…" : "Als erledigt markieren"}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
