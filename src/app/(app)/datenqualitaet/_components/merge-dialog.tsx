"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitMerge, Loader2 } from "lucide-react";
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

type ActionResult = { ok: boolean; message?: string };

export interface MergeCandidate {
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * Dialog zum Zusammenführen einer Dubletten-Gruppe. Der Nutzer wählt den
 * Datensatz, der erhalten bleibt (Ziel). Alle übrigen werden nacheinander in
 * das Ziel überführt und als inaktiv markiert.
 */
export function MergeDialog({
  entities,
  action,
  entityLabel,
}: {
  entities: MergeCandidate[];
  action: (sourceId: string, targetId: string) => Promise<ActionResult>;
  /** "Kandidat" | "Unternehmen" — für die Texte im Dialog. */
  entityLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [targetId, setTargetId] = React.useState(entities[0]?.id ?? "");
  const [pending, startTransition] = React.useTransition();

  const submit = () =>
    startTransition(async () => {
      const sources = entities.filter((e) => e.id !== targetId);
      if (sources.length === 0) {
        toast.error("Kein Quell-Datensatz ausgewählt.");
        return;
      }
      let okCount = 0;
      for (const src of sources) {
        const result = await action(src.id, targetId).catch(() => ({
          ok: false as const,
          message: "Verbindung fehlgeschlagen.",
        }));
        if (result.ok) {
          okCount += 1;
        } else {
          toast.error(result.message ?? "Zusammenführen fehlgeschlagen.");
          break;
        }
      }
      if (okCount > 0) {
        toast.success(
          `${okCount} ${entityLabel}${okCount > 1 ? "-Datensätze" : ""} zusammengeführt.`,
        );
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <GitMerge className="size-4" />
          Zusammenführen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entityLabel} zusammenführen</DialogTitle>
          <DialogDescription>
            Wähle den Datensatz, der erhalten bleibt. Notizen, Aufgaben, Tags und
            Kommunikation der übrigen werden auf diesen umgehängt; der
            Plattform-Datensatz bleibt bestehen, wird aber als inaktiv markiert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {entities.map((e) => (
            <label
              key={e.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent/40"
            >
              <input
                type="radio"
                name="merge-target"
                value={e.id}
                checked={targetId === e.id}
                onChange={() => setTargetId(e.id)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{e.label}</span>
                {e.sublabel && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {e.sublabel}
                  </span>
                )}
                {targetId === e.id && (
                  <span className="mt-1 inline-block text-xs font-medium text-primary">
                    bleibt erhalten
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending || !targetId}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Zusammenführen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
