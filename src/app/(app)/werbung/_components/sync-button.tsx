"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncNow } from "../actions";

export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline" size="sm" disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await syncNow().catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
          if (r.ok) toast.info(r.message ?? "Sync ausgeführt.", { duration: 6000 });
          else toast.error(r.message);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Jetzt synchronisieren
    </Button>
  );
}
