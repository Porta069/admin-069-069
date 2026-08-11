"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { toggleAutomation } from "../actions";

export function AutomationToggle({
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
      aria-label={enabled ? "Automation deaktivieren" : "Automation aktivieren"}
      onCheckedChange={async (next) => {
        setPending(true);
        const result = await toggleAutomation(id, next);
        setPending(false);
        if (result.ok) {
          toast.success(
            next
              ? "Automation aktiviert — Ausführung startet mit der Engine"
              : "Automation deaktiviert",
          );
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    />
  );
}
