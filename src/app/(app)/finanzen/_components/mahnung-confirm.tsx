"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendReminder } from "../actions";

/**
 * Bestätigungsleiste unter der Mahnungs-Vorschau: absenden (protokolliert die
 * Mahnung) oder verwerfen. Erst nach „Absenden" wird die Mahnung im System
 * vermerkt — die Vorschau selbst ändert nichts.
 */
export function MahnungConfirm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const absenden = () =>
    startTransition(async () => {
      const res = await sendReminder(id);
      if (res.ok) {
        toast.success(res.message ?? "Mahnung abgesendet.");
        router.push(`/finanzen/${id}`);
        router.refresh();
      } else {
        toast.error(res.message ?? "Mahnung konnte nicht abgesendet werden.");
      }
    });

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/finanzen/${id}`)}
        disabled={pending}
      >
        <X className="size-4" />
        Nicht absenden
      </Button>
      <Button size="sm" onClick={absenden} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Mahnung absenden
      </Button>
    </div>
  );
}
