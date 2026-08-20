import type { StatusDef } from "@/lib/definitions";

/** Status-Pipeline der Unternehmens-Anwerbung. */
export const LEAD_STATUSES = [
  "NEU",
  "KONTAKTIERT",
  "INTERESSIERT",
  "GEWONNEN",
  "ABGELEHNT",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS: Record<string, StatusDef> = {
  NEU: { label: "Neu", tone: "info" },
  KONTAKTIERT: { label: "Kontaktiert", tone: "progress" },
  INTERESSIERT: { label: "Interessiert", tone: "warning" },
  GEWONNEN: { label: "Gewonnen", tone: "success" },
  ABGELEHNT: { label: "Abgelehnt", tone: "neutral" },
};
