"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { setWhatsappEnabled } from "../actions";

/**
 * Master-Schalter „WhatsApp aktivieren". Der Zustand wird gespeichert, aber
 * ohne angebundene Integration bleibt der tatsächliche Versand aus — daher
 * bewusst nur als Anzeige mit Hinweis. Ist `canToggle` false, ist der Schalter
 * deaktiviert.
 */
export function MasterSwitch({
  aktiviert,
  canToggle,
}: {
  aktiviert: boolean;
  canToggle: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-sm text-muted-foreground">
        {aktiviert ? "Aktiviert" : "Deaktiviert"}
      </span>
      <Switch
        checked={aktiviert}
        disabled={!canToggle || pending}
        aria-label={
          aktiviert ? "WhatsApp deaktivieren" : "WhatsApp aktivieren"
        }
        onCheckedChange={async (next) => {
          setPending(true);
          const result = await setWhatsappEnabled(next);
          setPending(false);
          if (result.ok) {
            toast.success(
              next
                ? "WhatsApp aktiviert — Versand startet mit der Integration"
                : "WhatsApp deaktiviert",
            );
            router.refresh();
          } else {
            toast.error(result.message);
          }
        }}
      />
    </div>
  );
}
