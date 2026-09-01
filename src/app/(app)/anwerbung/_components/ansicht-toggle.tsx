"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Umschalter Board ↔ Tabelle; erhält die übrigen Query-Parameter. */
export function AnsichtToggle({ value }: { value: "board" | "tabelle" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (v: "board" | "tabelle") => {
    const params = new URLSearchParams(searchParams);
    params.set("ansicht", v);
    params.delete("page"); // Seitenzahl der Tabelle beim Wechsel zurücksetzen
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const btn = (v: "board" | "tabelle", icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => go(v)}
      className={cn(
        "flex items-center gap-1.5 rounded px-2.5 py-1 text-sm transition-colors",
        value === v
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={value === v}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      {btn("board", <LayoutGrid className="size-4" />, "Board")}
      {btn("tabelle", <Table2 className="size-4" />, "Tabelle")}
    </div>
  );
}
