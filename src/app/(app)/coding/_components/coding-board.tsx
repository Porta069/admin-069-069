"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toggleCodingTask, addCodingTask, deleteCodingTask } from "../actions";

export interface CodingTask {
  id: string;
  titel: string;
  beschreibung: string | null;
  kategorie: string;
  prioritaet: "HIGH" | "MEDIUM" | "LOW";
  erledigt: boolean;
}

const PRIO_META: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "Hoch", cls: "text-destructive bg-destructive/10 border-destructive/25" },
  MEDIUM: { label: "Mittel", cls: "text-warning bg-warning-soft border-warning/25" },
  LOW: { label: "Niedrig", cls: "text-muted-foreground bg-muted border-border" },
};

export function CodingBoard({ tasks }: { tasks: CodingTask[] }) {
  const router = useRouter();
  const [state, setState] = React.useState(tasks);
  const [neu, setNeu] = React.useState("");
  const [kat, setKat] = React.useState("Allgemein");
  const [prio, setPrio] = React.useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setState(tasks), [tasks]);

  const erledigt = state.filter((t) => t.erledigt).length;
  const gesamt = state.length;
  const prozent = gesamt ? Math.round((erledigt / gesamt) * 100) : 0;

  // Nach Kategorie gruppieren; offene zuerst, erledigte darunter.
  const gruppen = React.useMemo(() => {
    const map = new Map<string, CodingTask[]>();
    for (const t of state) {
      if (!map.has(t.kategorie)) map.set(t.kategorie, []);
      map.get(t.kategorie)!.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.erledigt) - Number(b.erledigt));
    }
    return [...map.entries()];
  }, [state]);

  const toggle = async (t: CodingTask, checked: boolean) => {
    setState((s) => s.map((x) => (x.id === t.id ? { ...x, erledigt: checked } : x)));
    const res = await toggleCodingTask(t.id, checked);
    if (!res.ok) {
      setState((s) => s.map((x) => (x.id === t.id ? { ...x, erledigt: !checked } : x)));
      toast.error(res.message);
    }
  };

  const entfernen = async (t: CodingTask) => {
    setState((s) => s.filter((x) => x.id !== t.id));
    const res = await deleteCodingTask(t.id);
    if (!res.ok) {
      toast.error(res.message);
      router.refresh();
    }
  };

  const hinzufuegen = async () => {
    if (!neu.trim()) return;
    setPending(true);
    const res = await addCodingTask({ titel: neu, kategorie: kat, prioritaet: prio });
    setPending(false);
    if (res.ok) {
      setNeu("");
      toast.success("Punkt hinzugefügt.");
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Fortschritt */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold">Fortschritt</p>
            <p className="text-xs text-muted-foreground">
              {erledigt} von {gesamt} erledigt
            </p>
          </div>
          <span className="font-display text-2xl font-bold tabular text-success">{prozent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${prozent}%` }}
          />
        </div>
      </div>

      {/* Neuer Punkt */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && hinzufuegen()}
            placeholder="Neuer Punkt / was noch fehlt…"
          />
          <Input
            value={kat}
            onChange={(e) => setKat(e.target.value)}
            placeholder="Kategorie"
            className="sm:w-36"
          />
          <select
            value={prio}
            onChange={(e) => setPrio(e.target.value as "HIGH" | "MEDIUM" | "LOW")}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Priorität"
          >
            <option value="HIGH">Hoch</option>
            <option value="MEDIUM">Mittel</option>
            <option value="LOW">Niedrig</option>
          </select>
          <Button onClick={hinzufuegen} disabled={pending || !neu.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Gruppen */}
      {gruppen.map(([kategorie, items]) => {
        const done = items.filter((i) => i.erledigt).length;
        return (
          <section key={kategorie} className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              {kategorie}
              <span className="text-xs font-normal text-muted-foreground">
                {done}/{items.length}
              </span>
            </h2>
            <ul className="divide-y">
              {items.map((t) => {
                const meta = PRIO_META[t.prioritaet] ?? PRIO_META.MEDIUM;
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "group flex items-start gap-3 py-2.5 transition-opacity",
                      t.erledigt && "opacity-55",
                    )}
                  >
                    <Checkbox
                      checked={t.erledigt}
                      onCheckedChange={(v) => toggle(t, Boolean(v))}
                      className="mt-0.5"
                      aria-label={t.titel}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", t.erledigt && "line-through")}>
                        {t.titel}
                      </p>
                      {t.beschreibung && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.beschreibung}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        meta.cls,
                      )}
                    >
                      {meta.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => entfernen(t)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Entfernen"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {gesamt > 0 && erledigt === gesamt && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          <Check className="size-4" /> Alles abgehakt — stark! 🎉
        </div>
      )}
    </div>
  );
}
