import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function EmployeeAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed text-muted-foreground",
          size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-7 text-xs",
          className,
        )}
      >
        –
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white",
        size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-7 text-xs",
        className,
      )}
      style={{ backgroundColor: color ?? "#78716c" }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
