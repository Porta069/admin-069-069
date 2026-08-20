"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { testAdConnection } from "../actions";
import type { Provider } from "@/lib/ads/platforms";

export function TestConnectionButton({ provider }: { provider: Provider }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await testAdConnection(provider).catch(() => ({
            ok: false as const,
            message: "Verbindung fehlgeschlagen.",
          }));
          if (r.ok) toast.success(r.message ?? "Verbunden.", { duration: 8000 });
          else toast.error(r.message ?? "Test fehlgeschlagen.", { duration: 10000 });
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
      Verbindung testen
    </Button>
  );
}
