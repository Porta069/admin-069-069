"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/status-badge";
import type { StatusDef } from "@/lib/definitions";
import { formatDate, formatTime } from "@/lib/format";
import {
  Check,
  Clock,
  MapPin,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { deleteAppointment, setAppointmentStatus } from "../actions";

export const APPOINTMENT_STATUS: Record<string, StatusDef> = {
  PLANNED: { label: "Geplant", tone: "info" },
  DONE: { label: "Stattgefunden", tone: "success" },
  CANCELLED: { label: "Abgesagt", tone: "neutral" },
};

export interface AppointmentData {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: string;
  employeeName: string | null;
  employeeColor: string | null;
  /** Serverseitig berechnet: ends_at < now und status PLANNED. */
  missed?: boolean;
}

export function AppointmentItem({
  appointment,
  variant,
  canEdit,
  canDelete,
  style,
  className,
}: {
  appointment: AppointmentData;
  variant: "chip" | "block" | "row";
  canEdit: boolean;
  canDelete: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const cancelled = appointment.status === "CANCELLED";
  const done = appointment.status === "DONE";
  const missed = appointment.missed === true && appointment.status === "PLANNED";
  const accent = appointment.employeeColor ?? "var(--primary)";
  /** Dezente Füllung in Mitarbeiterfarbe (bzw. primary) für geplante Termine. */
  const accentFill: React.CSSProperties | undefined =
    cancelled || done || missed
      ? undefined
      : {
          borderLeftColor: accent,
          backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`,
        };

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Aktion fehlgeschlagen");
      }
    });

  const trigger =
    variant === "chip" ? (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1 truncate rounded border-l-2 border-transparent px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors",
          cancelled
            ? "bg-muted text-muted-foreground line-through"
            : missed
              ? "border-destructive bg-destructive/10 text-destructive hover:opacity-80"
              : done
                ? "border-success bg-success-soft text-success hover:opacity-80"
                : "text-foreground hover:opacity-80",
          className,
        )}
        style={{ ...accentFill, ...style }}
      >
        <span className="truncate">
          <span className="tabular">{formatTime(appointment.startsAt)}</span>{" "}
          {appointment.title}
        </span>
        {missed && <TriangleAlert className="ml-auto size-3 shrink-0" />}
      </button>
    ) : variant === "block" ? (
      <button
        type="button"
        className={cn(
          "absolute overflow-hidden rounded border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-85",
          cancelled
            ? "border-muted-foreground/40 bg-muted text-muted-foreground line-through"
            : missed
              ? "border-destructive bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/40"
              : done
                ? "border-success bg-success-soft text-success"
                : "text-foreground",
          className,
        )}
        style={{ ...accentFill, ...style }}
      >
        <span className="block truncate font-semibold">
          {appointment.title}
        </span>
        <span className="block truncate tabular">
          {missed && <span className="font-semibold">Verpasst · </span>}
          {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
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
            missed && "bg-destructive",
          )}
          style={missed ? undefined : { backgroundColor: accent }}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {appointment.title}
          </span>
          <span
            className={cn(
              "block text-xs tabular",
              missed ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {missed && "Verpasst · "}
            {formatDate(appointment.startsAt)} ·{" "}
            {formatTime(appointment.startsAt)} Uhr
          </span>
        </span>
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment.title}</DialogTitle>
          <DialogDescription asChild>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge
                map={APPOINTMENT_STATUS}
                value={appointment.status}
              />
              {missed && (
                <Badge variant="destructive">
                  <TriangleAlert />
                  Verpasst
                </Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            <span className="tabular">
              {formatDate(appointment.startsAt)},{" "}
              {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}{" "}
              Uhr
            </span>
          </p>
          {appointment.location && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {appointment.location}
            </p>
          )}
          {appointment.employeeName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4 shrink-0" />
              {appointment.employeeName}
            </p>
          )}
          {appointment.description && (
            <p className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
              {appointment.description}
            </p>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  run(() => deleteAppointment(appointment.id), "Termin gelöscht")
                }
              >
                <Trash2 className="size-4" />
                Löschen
              </Button>
            )}
          </div>
          {canEdit && appointment.status === "PLANNED" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setAppointmentStatus(appointment.id, "CANCELLED"),
                    "Termin abgesagt",
                  )
                }
              >
                <X className="size-4" />
                Absagen
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setAppointmentStatus(appointment.id, "DONE"),
                    "Termin als stattgefunden markiert",
                  )
                }
              >
                <Check className="size-4" />
                Stattgefunden
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
