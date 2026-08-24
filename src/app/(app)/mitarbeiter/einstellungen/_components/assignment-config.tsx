"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { ROUTING_STEPS } from "@/lib/assignment-steps";
import { Check, Loader2, User, Workflow } from "lucide-react";
import { saveAssignmentConfig } from "../actions";

interface Emp {
  id: string;
  name: string;
}

export function AssignmentConfig({
  employees,
  initialMode,
  initialPool,
  initialSplit,
}: {
  employees: Emp[];
  initialMode: "complete" | "split";
  initialPool: string[];
  initialSplit: Record<string, string>;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"complete" | "split">(initialMode);
  const [pool, setPool] = React.useState<Set<string>>(new Set(initialPool));
  const [split, setSplit] = React.useState<Record<string, string>>(initialSplit);
  const [pending, setPending] = React.useState(false);

  const togglePool = (id: string) =>
    setPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const speichern = async () => {
    setPending(true);
    const res = await saveAssignmentConfig({
      mode,
      pool: [...pool],
      split,
    });
    setPending(false);
    if (res.ok) {
      toast.success("Zuweisungs-Routing gespeichert.");
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-sm font-semibold">Automatische Zuweisung</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Wähle, ob ein Mitarbeiter den kompletten Ablauf betreut oder die Schritte
        auf mehrere aufgeteilt werden. Die Zuweisung passiert dann automatisch.
      </p>

      {/* Modus-Wahl */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "complete"}
          onClick={() => setMode("complete")}
          icon={User}
          title="Kompletter Flow"
          desc="Ein Mitarbeiter betreut den ganzen Ablauf. Neue Kandidaten werden reihum auf den Pool verteilt."
        />
        <ModeCard
          active={mode === "split"}
          onClick={() => setMode("split")}
          icon={Workflow}
          title="Flow-Aufteilung"
          desc="Je Schritt ein Mitarbeiter. Beispiel: A telefoniert, danach ist automatisch B zuständig."
        />
      </div>

      {/* Konfiguration je Modus */}
      {mode === "complete" ? (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium">Pool (Round-Robin-Verteilung)</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {employees.map((e) => {
              const an = pool.has(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => togglePool(e.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    an ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      an ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {an && <Check className="size-3" />}
                  </span>
                  {e.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ausgewählte Mitarbeiter erhalten neue Kandidaten der Reihe nach.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          <p className="text-sm font-medium">Zuständig je Schritt</p>
          {ROUTING_STEPS.map((step) => (
            <div key={step} className="flex flex-wrap items-center gap-3">
              <span className="w-40 shrink-0 text-sm">
                {CANDIDATE_STATUS[step]?.label ?? step}
              </span>
              <Select
                value={split[step] ?? "__none__"}
                onValueChange={(v) =>
                  setSplit((prev) => ({ ...prev, [step]: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger className="w-64 max-w-full">
                  <SelectValue placeholder="— niemand (unverändert) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— niemand (unverändert) —</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Erreicht ein Kandidat einen Schritt, wird er automatisch dem hinterlegten
            Mitarbeiter zugeordnet. Nicht gesetzte Schritte lassen die Zuständigkeit unverändert.
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={speichern} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Speichern
        </Button>
      </div>
    </section>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
        {title}
        {active && <Check className="ml-auto size-4 text-primary" />}
      </span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}
