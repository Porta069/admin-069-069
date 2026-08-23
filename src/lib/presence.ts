/**
 * Präsenz-Ableitung. `presence` ist der explizit gesetzte Zustand, `lastSeenAt`
 * der letzte Heartbeat. Online ergibt sich aus Frische — manuelle Zustände
 * (Abwesend/Urlaub/Im Call) haben Vorrang. Isomorph (kein server-only), damit
 * die Anzeige überall genutzt werden kann.
 */

export type EffektivePraesenz = "ONLINE" | "OFFLINE" | "ABWESEND" | "URLAUB" | "IM_CALL";

/** Manuell wählbare Zustände (im Umschalter). */
export const PRAESENZ_WAHL = [
  { key: "AVAILABLE", label: "Verfügbar" },
  { key: "ABWESEND", label: "Abwesend" },
  { key: "URLAUB", label: "Im Urlaub" },
] as const;

const FRISCH_MS = 5 * 60 * 1000; // 5 Minuten

export const PRAESENZ_META: Record<
  EffektivePraesenz,
  { label: string; dot: string; text: string }
> = {
  ONLINE: { label: "Online", dot: "bg-success", text: "text-success" },
  IM_CALL: { label: "Im Call", dot: "bg-primary", text: "text-primary" },
  ABWESEND: { label: "Abwesend", dot: "bg-warning", text: "text-warning" },
  URLAUB: { label: "Im Urlaub", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  OFFLINE: { label: "Offline", dot: "bg-muted-foreground/30", text: "text-muted-foreground" },
};

export function effektivePraesenz(
  presence: string | null | undefined,
  lastSeenAt: Date | string | null | undefined,
  jetzt: number = Date.now(),
): EffektivePraesenz {
  if (presence === "IM_CALL") return "IM_CALL";
  if (presence === "URLAUB") return "URLAUB";
  if (presence === "ABWESEND") return "ABWESEND";
  // AVAILABLE (oder unbekannt): online, wenn der letzte Heartbeat frisch ist.
  if (lastSeenAt) {
    const t = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
    if (!Number.isNaN(t) && jetzt - t < FRISCH_MS) return "ONLINE";
  }
  return "OFFLINE";
}
