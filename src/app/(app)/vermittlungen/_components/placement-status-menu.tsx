"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLACEMENT_STATUS } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { setPlacementStatus } from "../actions";

const FLOW: string[] = ["PLACED", "INVOICED", "PAID"];

export function PlacementStatusMenu({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, startTransition] = React.useTransition();

  const change = (next: string) => {
    if (next === status) return;
    startTransition(async () => {
      const result = await setPlacementStatus(id, next);
      if (result.ok) toast.success(result.message ?? "Status aktualisiert.");
      else toast.error(result.message);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          Status
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Status setzen</DropdownMenuLabel>
        {FLOW.map((value) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => change(value)}
            disabled={value === status}
          >
            <Check
              className={cn("size-4", value === status ? "opacity-100" : "opacity-0")}
            />
            {PLACEMENT_STATUS[value]?.label ?? value}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => change("CANCELLED")}
          disabled={status === "CANCELLED"}
        >
          <Check
            className={cn(
              "size-4",
              status === "CANCELLED" ? "opacity-100" : "opacity-0",
            )}
          />
          {PLACEMENT_STATUS.CANCELLED.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
