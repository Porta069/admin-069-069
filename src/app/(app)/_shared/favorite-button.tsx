"use client";

import * as React from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  toggleFavorite,
  type FavoriteEntityType,
} from "./favorite-actions";

/** Stern-Button zum Favorisieren eines Datensatzes (pro Mitarbeiter). */
export function FavoriteButton({
  entityType,
  entityId,
  initialFavorited,
}: {
  entityType: FavoriteEntityType;
  entityId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = React.useState(initialFavorited);
  const [pending, startTransition] = React.useTransition();

  const toggle = () => {
    const next = !favorited;
    setFavorited(next); // optimistisch
    startTransition(async () => {
      const result = await toggleFavorite(entityType, entityId);
      if (!result.ok) {
        setFavorited(!next);
        toast.error(result.message);
      } else {
        setFavorited(result.favorited);
      }
    });
  };

  const label = favorited ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            disabled={pending}
            aria-label={label}
            aria-pressed={favorited}
          >
            <Star
              className={cn(
                "size-4 transition-colors",
                favorited
                  ? "fill-primary text-primary"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
