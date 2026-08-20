"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type ActionResult = { ok: boolean; message?: string };
const NONE = "__none__";

/**
 * Zuständigkeits-Auswahl mit Bestätigung. Eine Änderung wird erst nach
 * expliziter Bestätigung gespeichert (verhindert versehentliche Umzuordnung).
 * Die eigentliche Berechtigung wird serverseitig in der Action geprüft.
 */
export function AssigneeSelect({
  entityId,
  value,
  options,
  emptyLabel = "Niemand zugewiesen",
  action,
}: {
  entityId: string;
  value: string | null;
  options: { value: string; label: string }[];
  emptyLabel?: string;
  action: (id: string, value: string | null) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [wunsch, setWunsch] = React.useState<string | null>(null); // ausgewählt, noch nicht bestätigt

  const nameVon = (v: string | null) =>
    v === null ? emptyLabel : options.find((o) => o.value === v)?.label ?? "—";

  const bestaetigen = () =>
    startTransition(async () => {
      const ziel = wunsch === NONE ? null : wunsch;
      const r = await action(entityId, ziel).catch(() => ({
        ok: false as const, message: "Verbindung fehlgeschlagen.",
      }));
      if (r.ok) {
        toast.success(r.message ?? "Zuständigkeit aktualisiert.");
        setWunsch(null);
        router.refresh();
      } else toast.error(r.message ?? "Aktion fehlgeschlagen.");
    });

  return (
    <>
      <Select
        value={value ?? NONE}
        disabled={pending}
        onValueChange={(v) => {
          if (v === (value ?? NONE)) return;
          setWunsch(v);
        }}
      >
        <SelectTrigger className="w-full bg-card" size="sm">
          <SelectValue placeholder="Auswählen…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{emptyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={wunsch !== null} onOpenChange={(o) => !o && setWunsch(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Zuständigkeit ändern?</DialogTitle>
            <DialogDescription>
              Von <span className="font-medium text-foreground">{nameVon(value)}</span> zu{" "}
              <span className="font-medium text-foreground">{nameVon(wunsch === NONE ? null : wunsch)}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWunsch(null)} disabled={pending}>Abbrechen</Button>
            <Button onClick={bestaetigen} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
