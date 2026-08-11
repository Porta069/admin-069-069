/** Fallback-Werte, falls die Settings-Zeilen noch nicht angelegt sind. */

export const DEFAULT_PRICING = {
  base_fee_cents: 4900,
  max_commission_cents: 250000,
  referral_reward_cents: 10000,
} as const;

export type ListSettingKey =
  | "candidate_statuses"
  | "company_statuses"
  | "note_categories";

export const LIST_DEFAULTS: Record<ListSettingKey, string[]> = {
  candidate_statuses: [
    "NEU",
    "IN_BEARBEITUNG",
    "GEPRUEFT",
    "MATCHING",
    "VORGESCHLAGEN",
    "BEWERBUNG",
    "INTERVIEW",
    "ZUSAGE",
    "VERMITTELT",
    "ABGELEHNT",
    "INAKTIV",
  ],
  company_statuses: [
    "NEU",
    "KONTAKTIERT",
    "AKTIV",
    "PREMIUM",
    "PAUSIERT",
    "INAKTIV",
  ],
  note_categories: ["Allgemein", "Telefonat", "Interview", "Intern"],
};

/** Robust gegen beide Speicherformen: `["A","B"]` oder `{"values":["A","B"]}`. */
export function readListValue(value: unknown, key: ListSettingKey): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { values?: unknown }).values)
  ) {
    return ((value as { values: unknown[] }).values).filter(
      (v): v is string => typeof v === "string",
    );
  }
  return LIST_DEFAULTS[key];
}
