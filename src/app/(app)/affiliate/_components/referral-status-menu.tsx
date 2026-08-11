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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { REFERRAL_STATUS } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { changeReferralStatus } from "../actions";

const ORDER: string[] = ["REGISTERED", "IN_PLACEMENT", "PLACED", "PAID"];

export function ReferralStatusMenu({
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
      const result = await changeReferralStatus(id, next);
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
        {ORDER.map((value) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => change(value)}
            disabled={value === status}
          >
            <Check
              className={cn("size-4", value === status ? "opacity-100" : "opacity-0")}
            />
            {REFERRAL_STATUS[value]?.label ?? value}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
