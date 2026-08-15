"use client";

import * as React from "react";
import { toast } from "sonner";
import { BadgeEuro, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markRetentionPaid } from "../actions";

export function MarkRetentionPaidButton({ placementId }: { placementId: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 bg-card px-2.5 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markRetentionPaid(placementId);
          if (result.ok) toast.success(result.message ?? "Als ausgezahlt markiert.");
          else toast.error(result.message);
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <BadgeEuro className="size-3.5" />
      )}
      200 € ausgezahlt
    </Button>
  );
}
