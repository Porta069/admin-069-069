"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITIES, PRIORITY_LABELS, TASK_STATUS } from "@/lib/definitions";
import { Check, Circle, MoreHorizontal, Trash2 } from "lucide-react";
import {
  completeTask,
  deleteTask,
  setTaskPriority,
  setTaskStatus,
  type ActionResult,
} from "../actions";

export function CompleteTaskButton({
  taskId,
  done,
}: {
  taskId: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (done) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-success-soft text-success">
        <Check className="size-4" />
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="group size-7 rounded-full text-muted-foreground hover:text-success"
      disabled={pending}
      aria-label="Als erledigt markieren"
      title="Als erledigt markieren"
      onClick={() =>
        startTransition(async () => {
          const result = await completeTask(taskId);
          if (result.ok) {
            toast.success("Aufgabe erledigt");
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      <Circle className="size-4 group-hover:hidden" />
      <Check className="hidden size-4 group-hover:block" />
    </Button>
  );
}

export function TaskRowActions({
  taskId,
  canDelete,
}: {
  taskId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={pending}
          aria-label="Aktionen"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {Object.entries(TASK_STATUS).map(([value, def]) => (
          <DropdownMenuItem
            key={value}
            onClick={() =>
              run(() => setTaskStatus(taskId, value), `Status: ${def.label}`)
            }
          >
            {def.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Priorität</DropdownMenuLabel>
        {PRIORITIES.map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() =>
              run(
                () => setTaskPriority(taskId, p),
                `Priorität: ${PRIORITY_LABELS[p]}`,
              )
            }
          >
            {PRIORITY_LABELS[p]}
          </DropdownMenuItem>
        ))}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => run(() => deleteTask(taskId), "Aufgabe gelöscht")}
            >
              <Trash2 className="size-4" />
              Löschen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
