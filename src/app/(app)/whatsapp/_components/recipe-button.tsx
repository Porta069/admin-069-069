"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { createRule } from "../actions";
import type { Recipe } from "../constants";

/** Legt eine Beispiel-Regel mit einem Klick an. */
export function RecipeButton({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await createRule({
          name: recipe.title,
          trigger: recipe.trigger,
          verzoegerungStunden: recipe.verzoegerungStunden,
          nachricht: recipe.nachricht,
        });
        setPending(false);
        if (result.ok) {
          toast.success("Regel angelegt — noch deaktiviert");
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Plus className="size-4" />
      )}
      Anlegen
    </Button>
  );
}
