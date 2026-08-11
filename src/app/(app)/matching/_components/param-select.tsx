"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * URL-synchronisiertes Auswahlfeld: schreibt die Wahl in einen Suchparameter
 * und behält die übrigen Parameter bei.
 */
export function ParamSelect({
  param,
  placeholder,
  options,
  className,
}: {
  param: string;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? undefined;

  return (
    <Select
      value={current}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams);
        params.set(param, value);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <SelectTrigger className={className ?? "w-full bg-card"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
