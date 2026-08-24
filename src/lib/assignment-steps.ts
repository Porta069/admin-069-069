/**
 * Isomorphe Konstanten/Typen des Zuweisungs-Routings (kein server-only, kein
 * DB-Zugriff) — nutzbar in Client-Komponenten. Die Logik liegt in
 * assignment-routing.ts (server-only).
 */

export type AssignmentMode = "complete" | "split";

/** Schritte, die im Split-Modus einem Mitarbeiter zugeordnet werden können. */
export const ROUTING_STEPS = [
  "NEU",
  "ANGERUFEN",
  "MATCHING",
  "ABWICKLUNG",
  "BEWERBUNG",
  "ANGENOMMEN",
];
