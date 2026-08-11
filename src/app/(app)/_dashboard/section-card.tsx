import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Karten-Rahmen für Dashboard-Sektionen mit optionalem "Alle"-Link. */
export function SectionCard({
  title,
  icon: Icon,
  href,
  hrefLabel = "Alle",
  count,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border bg-card", className)}>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular">
            {count}
          </span>
        )}
        {href && (
          <Link
            href={href}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {hrefLabel}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </header>
      <div className="flex-1 p-2">{children}</div>
    </section>
  );
}

/** Dezenter Leer-Hinweis innerhalb einer Sektions-Karte. */
export function CardEmptyHint({ text }: { text: string }) {
  return (
    <p className="px-2 py-6 text-center text-sm text-muted-foreground/80">
      {text}
    </p>
  );
}
