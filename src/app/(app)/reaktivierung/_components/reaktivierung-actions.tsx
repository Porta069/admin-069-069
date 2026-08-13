"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAvailability, createReactivationTask } from "../actions";

/** Zwei Zeilen-Aktionen: Verfügbarkeit bestätigen + Reaktivierungs-Aufgabe. */
export function ReaktivierungActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await fn().catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Gespeichert.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Aktion fehlgeschlagen.");
      }
    });

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="bg-card"
        disabled={pending}
        onClick={() => run(() => confirmAvailability(applicationId))}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
        Verfügbar
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="bg-card"
        disabled={pending}
        onClick={() => run(() => createReactivationTask(applicationId))}
      >
        <ListPlus className="size-3.5" />
        Aufgabe
      </Button>
    </div>
  );
}
