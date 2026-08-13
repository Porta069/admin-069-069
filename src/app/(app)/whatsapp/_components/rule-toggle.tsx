"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { updateRule } from "../actions";

export function RuleToggle({
  id,
  enabled,
  disabled,
}: {
  id: string;
  enabled: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Switch
      checked={enabled}
      disabled={disabled || pending}
      aria-label={enabled ? "Regel deaktivieren" : "Regel aktivieren"}
      onCheckedChange={async (next) => {
        setPending(true);
        const result = await updateRule({ id, enabled: next });
        setPending(false);
        if (result.ok) {
          toast.success(
            next
              ? "Regel aktiviert — Ausführung startet mit der Integration"
              : "Regel deaktiviert",
          );
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    />
  );
}
