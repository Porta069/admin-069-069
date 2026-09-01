/**
 * Isomorphe Konstanten/Typen des Zuweisungs-Routings (kein server-only, kein
 * DB-Zugriff) — nutzbar in Client-Komponenten. Die Logik liegt in
 * assignment-routing.ts (server-only).
 */

export type AssignmentMode = "complete" | "split";

/**
 * Schritte, die im Split-Modus einem Mitarbeiter zugeordnet werden können.
 * Nur Status, die tatsächlich ein Routing auslösen (autoKandidatStatus →
 * wendeRoutingAn): NEU, ANGERUFEN, ABWICKLUNG. MATCHING/BEWERBUNG/ANGENOMMEN
 * werden ausschließlich manuell gesetzt und lösen kein Routing aus — daher
 * hier nicht wählbar (sonst wirkungslose Dropdowns).
 */
export const ROUTING_STEPS = ["NEU", "ANGERUFEN", "ABWICKLUNG"];
