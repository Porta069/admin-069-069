import type { StatusDef } from "@/lib/definitions";

/** Status der automatisch erkannten Match-Vorschläge (admin.match_suggestion). */
export const SUGGESTION_STATUS: Record<string, StatusDef> = {
  NEU: { label: "Neu", tone: "info" },
  GESICHTET: { label: "Gesichtet", tone: "progress" },
  VORGESCHLAGEN: { label: "Übernommen", tone: "success" },
  VERWORFEN: { label: "Verworfen", tone: "neutral" },
};

export const SUGGESTION_STATUS_OPTIONS = [
  { value: "NEU", label: "Neu" },
  { value: "GESICHTET", label: "Gesichtet" },
  { value: "VORGESCHLAGEN", label: "Übernommen" },
  { value: "VERWORFEN", label: "Verworfen" },
];

/** Richtung des Matches. */
export const RICHTUNG_LABELS: Record<string, string> = {
  JOB_FUER_KANDIDAT: "Job für Kandidat",
  KANDIDAT_FUER_JOB: "Kandidat für Job",
};

export const RICHTUNG_OPTIONS = [
  { value: "JOB_FUER_KANDIDAT", label: "Job für Kandidat" },
  { value: "KANDIDAT_FUER_JOB", label: "Kandidat für Job" },
];

/** Schwellen-Filter für den Mindest-Score. */
export const SCORE_MIN_OPTIONS = [
  { value: "60", label: "ab 60 %" },
  { value: "70", label: "ab 70 %" },
  { value: "75", label: "ab 75 %" },
  { value: "80", label: "ab 80 %" },
  { value: "90", label: "ab 90 %" },
];

/** Ein Vorschlag gilt als „offen“, solange er weder übernommen noch verworfen ist. */
export const OFFEN_STATUS = ["NEU", "GESICHTET"] as const;

/** Farbstufe für die Score-Anzeige (farbcodiert nach Trefferqualität). */
export function scoreTone(score: number): "hoch" | "mittel" | "niedrig" {
  if (score >= 80) return "hoch";
  if (score >= 60) return "mittel";
  return "niedrig";
}
