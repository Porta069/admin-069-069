import type { StatusDef } from "@/lib/definitions";

/** Status-Pipeline der Unternehmens-Anwerbung (B2B-Akquise von Betrieben). */
export const LEAD_STATUSES = [
  "NEU",
  "KONTAKTIERT",
  "INTERESSIERT",
  "SYSTEMVORSTELLUNG",
  "VERTRAG",
  "GEWONNEN",
  "ABGELEHNT",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS: Record<string, StatusDef> = {
  NEU: { label: "Neu", tone: "info" },
  KONTAKTIERT: { label: "Kontaktiert", tone: "progress" },
  INTERESSIERT: { label: "Interessiert", tone: "warning" },
  SYSTEMVORSTELLUNG: { label: "Systemvorstellung", tone: "progress" },
  VERTRAG: { label: "Vertrag", tone: "warning" },
  GEWONNEN: { label: "Gewonnen", tone: "success" },
  ABGELEHNT: { label: "Abgelehnt", tone: "neutral" },
};

/**
 * Spalten-Reihenfolge im Pipeline-Board. Abgelehnt steht bewusst als letzte
 * Spalte (verlorene Leads), damit die aktive Pipeline links zusammenhängt.
 */
export const LEAD_PIPELINE = [
  "NEU",
  "KONTAKTIERT",
  "INTERESSIERT",
  "SYSTEMVORSTELLUNG",
  "VERTRAG",
  "GEWONNEN",
  "ABGELEHNT",
] as const;
