/**
 * Widget-Vokabular für die Dashboard-Personalisierung.
 * admin.dashboard_config.widgets speichert ein Array aktiver Keys in
 * Anzeige-Reihenfolge; leer/nicht vorhanden = alle in Standardreihenfolge.
 */

export const WIDGET_KEYS = [
  "kpis",
  "chart",
  "activity",
  "tasks",
  "appointments",
  "candidates",
  "companies",
  "favorites",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  kpis: "Kennzahlen (KPIs)",
  chart: "Registrierungen (30 Tage)",
  activity: "Letzte Aktivität",
  tasks: "Meine Aufgaben",
  appointments: "Meine Termine",
  candidates: "Meine Kandidaten",
  companies: "Meine Unternehmen",
  favorites: "Meine Favoriten",
};

export const DEFAULT_WIDGETS: WidgetKey[] = [...WIDGET_KEYS];

/** Unbekannte Keys und Duplikate herausfiltern; null bei Nicht-Array. */
export function sanitizeWidgets(input: unknown): WidgetKey[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: WidgetKey[] = [];
  for (const key of input) {
    if (
      typeof key === "string" &&
      (WIDGET_KEYS as readonly string[]).includes(key) &&
      !seen.has(key)
    ) {
      seen.add(key);
      out.push(key as WidgetKey);
    }
  }
  return out;
}
