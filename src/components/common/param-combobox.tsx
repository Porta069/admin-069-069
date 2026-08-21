"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ParamComboOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * URL-synchronisiertes, DURCHSUCHBARES Auswahlfeld — schreibt die Wahl in einen
 * Suchparameter und behält die übrigen bei. Sucht über Label + Hint (z. B.
 * Telefonnummer), damit auch bei vielen/gleichnamigen Einträgen schnell gefunden
 * werden kann. Ersatz für ParamSelect bei Job-/Unternehmens-/Kandidatenauswahl.
 */
export function ParamCombobox({
  param,
  placeholder,
  options,
  className,
  clearLabel,
}: {
  param: string;
  placeholder: string;
  options: ParamComboOption[];
  className?: string;
  /** Wenn gesetzt, gibt es einen Eintrag zum Zurücksetzen der Auswahl. */
  clearLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const current = searchParams.get(param) ?? null;
  const selected = options.find((o) => o.value === current);

  const setParam = (value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null) params.delete(param);
    else params.set(param, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-card font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Suchen (Name, Telefon …)" />
          <CommandList>
            <CommandEmpty>Keine Treffer.</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem value="__clear__" onSelect={() => setParam(null)}>
                  <Check className={cn("size-4", !current ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => setParam(o.value)}
                >
                  <Check className={cn("size-4", o.value === current ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
