import { cn } from "@/lib/utils";
import { statusDef, type StatusDef, type StatusTone } from "@/lib/definitions";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-info-soft text-info border-transparent",
  progress: "bg-accent text-accent-foreground border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-destructive/10 text-destructive border-transparent",
};

const TONE_DOTS: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/50",
  info: "bg-info",
  progress: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function StatusBadge({
  map,
  value,
  className,
  withDot = true,
}: {
  map: Record<string, StatusDef>;
  value: string | null | undefined;
  className?: string;
  withDot?: boolean;
}) {
  const def = statusDef(map, value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[def.tone],
        className,
      )}
    >
      {withDot && (
        <span className={cn("size-1.5 rounded-full", TONE_DOTS[def.tone])} />
      )}
      {def.label}
    </span>
  );
}
