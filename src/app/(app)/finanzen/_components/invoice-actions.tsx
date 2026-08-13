"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markInvoicePaid, sendReminder, cancelInvoice } from "../actions";

export function InvoiceActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const isPaid = status === "BEZAHLT";
  const isCancelled = status === "STORNIERT";
  const canRemind = status === "OFFEN" || status === "UEBERFAELLIG";

  const run = (
    fn: (id: string) => Promise<{ ok: boolean; message?: string }>,
  ) => {
    startTransition(async () => {
      const result = await fn(id);
      if (result.ok) {
        toast.success(result.message ?? "Aktualisiert.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Aktion fehlgeschlagen.");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          disabled={pending}
          aria-label="Aktionen"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Rechnung</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => router.push(`/finanzen/${id}`)}
        >
          Rechnung öffnen
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => run(markInvoicePaid)}
          disabled={isPaid || isCancelled}
        >
          Als bezahlt markieren
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => run(sendReminder)}
          disabled={!canRemind}
        >
          Mahnung senden
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => run(cancelInvoice)}
          disabled={isPaid || isCancelled}
        >
          Stornieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
