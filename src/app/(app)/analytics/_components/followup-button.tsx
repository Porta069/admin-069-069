"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFollowupTask } from "./betriebs-health-actions";

export function FollowupButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="bg-card"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createFollowupTask(companyId, companyName).catch(
            () => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }),
          );
          if (result.ok) {
            toast.success(result.message ?? "Aufgabe angelegt.");
            router.refresh();
          } else {
            toast.error(result.message ?? "Aktion fehlgeschlagen.");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ListPlus className="size-3.5" />
      )}
      Aufgabe erstellen
    </Button>
  );
}
