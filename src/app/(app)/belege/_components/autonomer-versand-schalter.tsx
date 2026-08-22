"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MailCheck, ShieldAlert } from "lucide-react";
import { setAutonomerVersand } from "../actions";

export function AutonomerVersandSchalter({
  aktiv,
  disabled,
}: {
  aktiv: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <div
      className={`mb-6 flex flex-wrap items-center gap-4 rounded-lg border p-4 ${
        aktiv ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
          aktiv ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
        }`}
      >
        {aktiv ? <MailCheck className="size-5" /> : <ShieldAlert className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Autonomer Versand {aktiv ? "aktiv" : "ausgeschaltet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {aktiv
            ? "Aktivierte Vorlagen werden bei ihrem Ereignis automatisch versendet. Achte darauf, dass deine Plattform diese Mails nicht bereits selbst verschickt (Doppelversand)."
            : "Nichts wird automatisch versendet — egal welche Vorlage aktiv ist. Erst einschalten, wenn geklärt ist, welche Ereignis-Mails das Dashboard (statt der Plattform) übernehmen soll."}
        </p>
      </div>
      <Switch
        checked={aktiv}
        disabled={disabled || pending}
        aria-label={aktiv ? "Autonomen Versand ausschalten" : "Autonomen Versand einschalten"}
        onCheckedChange={async (next) => {
          setPending(true);
          const result = await setAutonomerVersand(next);
          setPending(false);
          if (result.ok) {
            toast.success(result.message ?? "Gespeichert.");
            router.refresh();
          } else {
            toast.error(result.message);
          }
        }}
      />
    </div>
  );
}
