"use client";

import * as React from "react";
import { toast } from "sonner";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markRewardPaid } from "../actions";

export function MarkPaidButton({ referralId }: { referralId: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 bg-card px-2 text-xs"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markRewardPaid(referralId);
          if (result.ok) toast.success(result.message ?? "Prämie ausgezahlt.");
          else toast.error(result.message);
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <BadgeCheck className="size-3.5" />
      )}
      Als bezahlt markieren
    </Button>
  );
}
