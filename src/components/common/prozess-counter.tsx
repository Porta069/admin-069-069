import { cn } from "@/lib/utils";
import { STUFEN, type ProzessStufe } from "@/lib/fortschritt";

/**
 * Kompakter Prozess-Fortschritt eines Nutzers: Neu → Angerufen → Angebot →
 * Vermittelt. Erreichte Stufen sind gefüllt, die aktuelle hervorgehoben.
 * `variant="dots"` (Listen, sehr kompakt) oder `variant="labeled"` (Detailkopf).
 */
export function ProzessCounter({
  stufe,
  variant = "dots",
  className,
}: {
  stufe: ProzessStufe;
  variant?: "dots" | "labeled";
  className?: string;
}) {
  const aktivIndex = STUFEN.findIndex((s) => s.key === stufe);

  if (variant === "labeled") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {STUFEN.map((s, i) => {
          const erreicht = i <= aktivIndex;
          const aktuell = i === aktivIndex;
          return (
            <span
              key={s.key}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                aktuell
                  ? "bg-primary text-primary-foreground"
                  : erreicht
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground/60",
              )}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      title={`Stufe: ${STUFEN[aktivIndex]?.label ?? "Neu"}`}
      aria-label={`Prozessstufe: ${STUFEN[aktivIndex]?.label ?? "Neu"}`}
    >
      {STUFEN.map((s, i) => (
        <span
          key={s.key}
          className={cn(
            "h-1.5 w-5 rounded-full transition-colors",
            i <= aktivIndex ? "bg-primary" : "bg-muted-foreground/20",
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">
        {STUFEN[aktivIndex]?.label ?? "Neu"}
      </span>
    </div>
  );
}
