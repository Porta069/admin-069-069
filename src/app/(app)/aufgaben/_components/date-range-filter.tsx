"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** URL-synchronisierter Zeitraum-Filter (?von=YYYY-MM-DD&bis=YYYY-MM-DD). */
export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const von = searchParams.get("von") ?? "";
  const bis = searchParams.get("bis") ?? "";

  const set = (param: "von" | "bis", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        value={von}
        onChange={(e) => set("von", e.target.value)}
        className="h-9 w-36 bg-card"
        aria-label="Zeitraum von"
      />
      <span className="text-sm text-muted-foreground" aria-hidden>
        –
      </span>
      <Input
        type="date"
        value={bis}
        onChange={(e) => set("bis", e.target.value)}
        className="h-9 w-36 bg-card"
        aria-label="Zeitraum bis"
      />
    </div>
  );
}
