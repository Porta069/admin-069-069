"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uebernehmenSuggestion, verwerfenSuggestion } from "../actions";

export function RowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<null | "up" | "down">(null);

  const run = async (kind: "up" | "down") => {
    if (pending) return;
    setPending(kind);
    const result =
      kind === "up"
        ? await uebernehmenSuggestion(id)
        : await verwerfenSuggestion(id);
    setPending(null);
    if (result.ok) {
      toast.success(
        kind === "up" ? "Als Vorschlag übernommen" : "Vorschlag verworfen",
      );
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <span className="flex items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 bg-card"
        disabled={pending !== null}
        onClick={() => run("up")}
      >
        {pending === "up" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5 text-success" />
        )}
        Übernehmen
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 text-muted-foreground hover:text-destructive"
        aria-label="Vorschlag verwerfen"
        disabled={pending !== null}
        onClick={() => run("down")}
      >
        {pending === "down" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <X className="size-3.5" />
        )}
      </Button>
    </span>
  );
}
