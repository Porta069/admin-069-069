import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  href,
  className,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Percentage or absolute change; positive renders green, negative red. */
  delta?: number | null;
  href?: string;
  className?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-4 transition-shadow",
        href && "hover:shadow-sm",
        className,
      )}
    >
      {accent && (
        <span className="absolute inset-y-0 left-0 w-0.75 bg-primary" aria-hidden />
      )}
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl leading-none font-semibold tabular">
        {value}
      </p>
      {(hint || delta !== undefined) && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {delta >= 0 ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
