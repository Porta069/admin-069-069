import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const SIZE = {
  sm: "size-6 text-[10px]",
  md: "size-7 text-xs",
  lg: "size-10 text-sm",
  xl: "size-20 text-xl",
} as const;

export function EmployeeAvatar({
  name,
  color,
  imageUrl,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  color?: string | null;
  /** Öffentliche Profilbild-URL; hat Vorrang vor Initialen. */
  imageUrl?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const cls = SIZE[size];

  if (imageUrl) {
    // Bewusst <img>: kleines, fixes Format, öffentliche Supabase-URL — kein
    // next/image-Setup (remotePatterns) nötig.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={name ? `Profilbild von ${name}` : "Profilbild"}
        title={name ?? undefined}
        className={cn("shrink-0 rounded-full object-cover", cls, className)}
      />
    );
  }

  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed text-muted-foreground",
          cls,
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
        cls,
        className,
      )}
      style={{ backgroundColor: color ?? "#78716c" }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
