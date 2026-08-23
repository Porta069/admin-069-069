/**
 * Reine Stufen-Definition des Prozess-Counters — isomorph (kein server-only,
 * kein DB-Zugriff), damit Client-Komponenten (ProzessCounter) sie nutzen können.
 * Die Datenermittlung liegt in fortschritt.ts (server-only).
 */

export type ProzessStufe = "NEU" | "ANGERUFEN" | "ANGEBOT" | "VERMITTELT";

export const STUFEN: { key: ProzessStufe; label: string }[] = [
  { key: "NEU", label: "Neu" },
  { key: "ANGERUFEN", label: "Angerufen" },
  { key: "ANGEBOT", label: "Angebot" },
  { key: "VERMITTELT", label: "Vermittelt" },
];
