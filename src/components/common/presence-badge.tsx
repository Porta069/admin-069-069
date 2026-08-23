import { cn } from "@/lib/utils";
import { effektivePraesenz, PRAESENZ_META } from "@/lib/presence";

/** Kleiner Präsenz-Punkt (optional mit Label). Serverseitig nutzbar. */
export function PresenceBadge({
  presence,
  lastSeenAt,
  withLabel = false,
  className,
}: {
  presence: string | null | undefined;
  lastSeenAt: Date | string | null | undefined;
  withLabel?: boolean;
  className?: string;
}) {
  const eff = effektivePraesenz(presence, lastSeenAt);
  const meta = PRAESENZ_META[eff];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={meta.label}>
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
      {withLabel && <span className={cn("text-xs", meta.text)}>{meta.label}</span>}
    </span>
  );
}

/** Präsenz-Punkt als Overlay unten rechts an einem Avatar. */
export function PresenceDot({
  presence,
  lastSeenAt,
}: {
  presence: string | null | undefined;
  lastSeenAt: Date | string | null | undefined;
}) {
  const eff = effektivePraesenz(presence, lastSeenAt);
  const meta = PRAESENZ_META[eff];
  return (
    <span
      className={cn(
        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card",
        meta.dot,
      )}
      title={meta.label}
      aria-label={`Präsenz: ${meta.label}`}
    />
  );
}
