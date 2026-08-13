import type { StatusDef } from "@/lib/definitions";

/** Status einer Rechnung (admin.invoice). */
export const INVOICE_STATUS: Record<string, StatusDef> = {
  OFFEN: { label: "Offen", tone: "info" },
  BEZAHLT: { label: "Bezahlt", tone: "success" },
  UEBERFAELLIG: { label: "Überfällig", tone: "danger" },
  STORNIERT: { label: "Storniert", tone: "neutral" },
};
