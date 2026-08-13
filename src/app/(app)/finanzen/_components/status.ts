import type { StatusDef } from "@/lib/definitions";

/** Status einer Rechnung (admin.invoice). */
export const INVOICE_STATUS: Record<string, StatusDef> = {
  OFFEN: { label: "Offen", tone: "info" },
  BEZAHLT: { label: "Bezahlt", tone: "success" },
  UEBERFAELLIG: { label: "Überfällig", tone: "danger" },
  STORNIERT: { label: "Storniert", tone: "neutral" },
};

/**
 * Rechnungsart (admin.invoice.art). KI-Analyse des Geschäftsmodells: für eine
 * Jobvermittlungsplattform sind genau diese Belegarten relevant —
 * Vermittlungshonorare an Betriebe, Premium-Account-Abrechnungen, die
 * Auszahlung des Empfehlungsmodells und ein generischer Sonstige-Beleg.
 */
export const INVOICE_ART: Record<string, StatusDef> = {
  VERMITTLUNG: { label: "Vermittlung", tone: "info" },
  PREMIUM: { label: "Premium-Account", tone: "progress" },
  REFERRAL: { label: "Empfehlung", tone: "success" },
  SONSTIGE: { label: "Sonstige", tone: "neutral" },
};

/** Position auf einer Rechnung (admin.invoice.positionen jsonb). */
export interface RechnungsPosition {
  bezeichnung: string;
  menge: number;
  einzelpreis_cents: number;
  betrag_cents: number;
}
