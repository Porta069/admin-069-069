"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Zeitraumfilter (?von=&bis=) für die Audit-Tabellen. */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: "von" | "bis", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="audit-von">
        Von
      </label>
      <Input
        id="audit-von"
        type="date"
        defaultValue={searchParams.get("von") ?? ""}
        onChange={(e) => setParam("von", e.target.value)}
        className="h-9 w-36 bg-card tabular"
        aria-label="Zeitraum von"
      />
      <span className="text-sm text-muted-foreground">–</span>
      <label className="sr-only" htmlFor="audit-bis">
        Bis
      </label>
      <Input
        id="audit-bis"
        type="date"
        defaultValue={searchParams.get("bis") ?? ""}
        onChange={(e) => setParam("bis", e.target.value)}
        className="h-9 w-36 bg-card tabular"
        aria-label="Zeitraum bis"
      />
    </div>
  );
}
