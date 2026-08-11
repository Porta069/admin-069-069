"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import { ArrowDown, ArrowUp, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { saveDashboardConfig } from "./actions";
import {
  DEFAULT_WIDGETS,
  WIDGET_LABELS,
  type WidgetKey,
} from "./widgets";

interface WidgetState {
  key: WidgetKey;
  enabled: boolean;
}

function buildState(active: WidgetKey[]): WidgetState[] {
  return [
    ...active.map((key) => ({ key, enabled: true })),
    ...DEFAULT_WIDGETS.filter((key) => !active.includes(key)).map((key) => ({
      key,
      enabled: false,
    })),
  ];
}

/** Zahnrad-Dialog: Widgets ein-/ausschalten und per ↑/↓ umsortieren. */
export function CustomizeDialog({ active }: { active: WidgetKey[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [items, setItems] = React.useState<WidgetState[]>(() =>
    buildState(active),
  );

  const move = (index: number, delta: -1 | 1) => {
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (pending) return;
    setPending(true);
    const widgets = items.filter((i) => i.enabled).map((i) => i.key);
    const result = await saveDashboardConfig(widgets);
    setPending(false);
    if (result.ok) {
      toast.success("Dashboard wurde angepasst");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setItems(buildState(active));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card">
          <Settings2 className="size-4" />
          Anpassen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard anpassen</DialogTitle>
          <DialogDescription>
            Widgets ein- oder ausschalten und die Reihenfolge festlegen.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {items.map((item, index) => (
            <li
              key={item.key}
              className="flex items-center gap-2 px-3 py-2"
            >
              <span
                className={
                  item.enabled
                    ? "flex-1 text-sm font-medium"
                    : "flex-1 text-sm text-muted-foreground"
                }
              >
                {WIDGET_LABELS[item.key]}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`${WIDGET_LABELS[item.key]} nach oben`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`${WIDGET_LABELS[item.key]} nach unten`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.key === item.key ? { ...i, enabled: checked } : i,
                    ),
                  )
                }
                aria-label={`${WIDGET_LABELS[item.key]} anzeigen`}
              />
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setItems(buildState(DEFAULT_WIDGETS))}
          >
            <RotateCcw className="size-4" />
            Zurücksetzen
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
