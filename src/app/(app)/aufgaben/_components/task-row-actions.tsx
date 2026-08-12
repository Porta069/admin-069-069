"use client";

import * as React from "react";
import Link from "next/link";
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
import {
  CalendarDays,
  Check,
  Circle,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  completeAppointment,
  completeTask,
  deleteTask,
  setTaskPriority,
  setTaskStatus,
  type ActionResult,
} from "../actions";

function DoneCircle() {
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-success-soft text-success">
      <Check className="size-4" />
    </span>
  );
}

export function CompleteTaskButton({
  taskId,
  done,
}: {
  taskId: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  // Sofortiges optimistisches Feedback: Kreis wird direkt zum Haken.
  const [optimisticDone, setOptimisticDone] = React.useState(false);

  if (done || optimisticDone) {
    return <DoneCircle />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="group size-7 rounded-full text-muted-foreground hover:bg-success-soft hover:text-success"
      disabled={pending}
      aria-label="Als erledigt markieren"
      title="Als erledigt markieren"
      onClick={() => {
        setOptimisticDone(true);
        startTransition(async () => {
          const result = await completeTask(taskId);
          if (result.ok) {
            toast.success("Aufgabe erledigt");
            router.refresh();
          } else {
            setOptimisticDone(false);
            toast.error(result.message);
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Circle className="size-4 group-hover:hidden" />
          <Check className="hidden size-4 group-hover:block" />
        </>
      )}
    </Button>
  );
}

/** Erledigt-Kreis für Termin-Zeilen — setzt status = 'DONE'. */
export function CompleteAppointmentButton({
  appointmentId,
  status,
  canComplete,
}: {
  appointmentId: string;
  /** Gemappter Status: OPEN | DONE | CANCELLED */
  status: string;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [optimisticDone, setOptimisticDone] = React.useState(false);

  if (status === "DONE" || optimisticDone) {
    return <DoneCircle />;
  }
  if (status === "CANCELLED") {
    return (
      <span
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground/60"
        title="Termin abgebrochen"
      >
        <X className="size-4" />
      </span>
    );
  }
  if (!canComplete) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground/60">
        <Circle className="size-4" />
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="group size-7 rounded-full text-muted-foreground hover:bg-success-soft hover:text-success"
      disabled={pending}
      aria-label="Termin als erledigt markieren"
      title="Termin als erledigt markieren"
      onClick={() => {
        setOptimisticDone(true);
        startTransition(async () => {
          const result = await completeAppointment(appointmentId);
          if (result.ok) {
            toast.success("Termin erledigt");
            router.refresh();
          } else {
            setOptimisticDone(false);
            toast.error(result.message);
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Circle className="size-4 group-hover:hidden" />
          <Check className="hidden size-4 group-hover:block" />
        </>
      )}
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

/** Reduzierte Aktionen für Termin-Zeilen in den Aufgabenlisten. */
export function AppointmentRowActions({
  appointmentId,
  isPlanned,
  canComplete,
}: {
  appointmentId: string;
  isPlanned: boolean;
  canComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

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
      <DropdownMenuContent align="end" className="w-52">
        {isPlanned && canComplete && (
          <DropdownMenuItem
            onClick={() =>
              startTransition(async () => {
                const result = await completeAppointment(appointmentId);
                if (result.ok) {
                  toast.success("Termin erledigt");
                  router.refresh();
                } else {
                  toast.error(result.message);
                }
              })
            }
          >
            <Check className="size-4" />
            Als erledigt markieren
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/kalender">
            <CalendarDays className="size-4" />
            Im Kalender öffnen
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
