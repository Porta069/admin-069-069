import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, type Priority } from "@/lib/definitions";
import { ArrowDown, ArrowUp, Flame, Minus } from "lucide-react";

const CONFIG: Record<Priority, { className: string; icon: React.ReactNode }> = {
  DRINGEND: {
    className: "text-destructive",
    icon: <Flame className="size-3.5" />,
  },
  HOCH: {
    className: "text-warning",
    icon: <ArrowUp className="size-3.5" />,
  },
  NORMAL: {
    className: "text-muted-foreground",
    icon: <Minus className="size-3.5" />,
  },
  NIEDRIG: {
    className: "text-muted-foreground/60",
    icon: <ArrowDown className="size-3.5" />,
  },
};

export function PriorityBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const priority = (value ?? "NORMAL") as Priority;
  const config = CONFIG[priority] ?? CONFIG.NORMAL;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap",
        config.className,
        className,
      )}
    >
      {config.icon}
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
