import type { StatusDef } from "@/lib/definitions";

/**
 * Lebenszyklus eines Vorschlags/Angebots (admin.proposal).
 * VORGESCHLAGEN → BETRIEB_INTERESSIERT → ANGEBOT → ANGENOMMEN/ABGELEHNT → VERMITTELT
 */
export const PROPOSAL_STATUS: Record<string, StatusDef> = {
  VORGESCHLAGEN: { label: "Vorgeschlagen", tone: "info" },
  BETRIEB_INTERESSIERT: { label: "Betrieb interessiert", tone: "progress" },
  ANGEBOT: { label: "Angebot", tone: "warning" },
  ANGENOMMEN: { label: "Angenommen", tone: "success" },
  ABGELEHNT: { label: "Abgelehnt", tone: "danger" },
  VERMITTELT: { label: "Vermittelt", tone: "success" },
};

export const PROPOSAL_STATUSES = Object.keys(PROPOSAL_STATUS);

/** Nicht-terminale Status = „offen". */
export const OPEN_PROPOSAL_STATUSES = [
  "VORGESCHLAGEN",
  "BETRIEB_INTERESSIERT",
  "ANGEBOT",
  "ANGENOMMEN",
];
