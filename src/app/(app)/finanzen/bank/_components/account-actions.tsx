"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteBankAccount } from "../actions";

export function AccountActions({
  id,
  canDelete,
}: {
  id: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteBankAccount(id);
      if (result.ok) {
        toast.success(result.message ?? "Konto entfernt.");
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
          aria-label="Kontoaktionen"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Konto</DropdownMenuLabel>
        <DropdownMenuItem disabled>
          <Link2 className="size-4" />
          Verbinden (folgt)
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={remove}>
              <Trash2 className="size-4" />
              Konto entfernen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
