import type { StatusDef } from "@/lib/definitions";

/**
 * Modul-lokales Vokabular für den WhatsApp-Bereich.
 * Der echte Versand (WhatsApp Business API) ist noch nicht angebunden — die
 * Regeln werden bereits gespeichert und greifen automatisch, sobald die
 * Integration steht.
 */

export const TRIGGERS = [
  "NACH_REGISTRIERUNG",
  "NACH_TERMIN",
  "KEINE_REAKTION",
  "MANUELL",
] as const;

export type WhatsappTrigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<WhatsappTrigger, string> = {
  NACH_REGISTRIERUNG: "Nach Registrierung",
  NACH_TERMIN: "Nach Termin",
  KEINE_REAKTION: "Keine Reaktion",
  MANUELL: "Manuell",
};

/** Kurze Erklärung des Auslösers für Tooltips/Beschreibungen. */
export const TRIGGER_DESCRIPTIONS: Record<WhatsappTrigger, string> = {
  NACH_REGISTRIERUNG:
    "Sobald sich ein Handwerker registriert hat.",
  NACH_TERMIN: "Nachdem ein Termin stattgefunden hat.",
  KEINE_REAKTION:
    "Wenn nach dem letzten Kontakt keine Reaktion erfolgt ist.",
  MANUELL: "Wird nur von Hand ausgelöst.",
};

export function isValidTrigger(value: string): value is WhatsappTrigger {
  return (TRIGGERS as readonly string[]).includes(value);
}

/** Status der geplanten/versendeten Nachrichten (admin.whatsapp_outbox). */
export const WHATSAPP_OUTBOX_STATUS: Record<string, StatusDef> = {
  GEPLANT: { label: "Geplant", tone: "info" },
  GESENDET: { label: "Gesendet", tone: "success" },
  ABGEBROCHEN: { label: "Abgebrochen", tone: "danger" },
};

/** Schnellauswahl-Chips für die Verzögerung (in Stunden). */
export const DELAY_CHIPS: { label: string; hours: number }[] = [
  { label: "sofort", hours: 0 },
  { label: "nach 2 Std.", hours: 2 },
  { label: "nach 1 Tag", hours: 24 },
  { label: "nach 2 Tagen", hours: 48 },
];

/** Maximale Verzögerung: 30 Tage. */
export const MAX_DELAY_HOURS = 24 * 30;

/** "sofort" · "nach 3 Std." · "nach 1 Tag" · "nach 2 Tagen" */
export function formatDelay(hours: number): string {
  const h = Math.max(0, Math.round(hours));
  if (h === 0) return "sofort";
  if (h % 24 === 0) {
    const days = h / 24;
    return days === 1 ? "nach 1 Tag" : `nach ${days} Tagen`;
  }
  return h === 1 ? "nach 1 Std." : `nach ${h} Std.`;
}

/** Unterstützte Template-Variablen (siehe renderTemplate in @/lib/mailer). */
export const TEMPLATE_VARS = [
  "{first_name}",
  "{last_name}",
  "{company}",
  "{job_title}",
] as const;

export interface Recipe {
  title: string;
  description: string;
  trigger: WhatsappTrigger;
  verzoegerungStunden: number;
  nachricht: string;
}

/** Rezept-Karten zum Ein-Klick-Anlegen. */
export const RECIPES: Recipe[] = [
  {
    title: "Nach Registrierung Anruf ankündigen",
    description:
      "2 Stunden nach der Registrierung kündigen wir per WhatsApp den Anruf an.",
    trigger: "NACH_REGISTRIERUNG",
    verzoegerungStunden: 2,
    nachricht:
      "Hallo {first_name}, willkommen bei Porta Werk! Wir melden uns in Kürze telefonisch bei dir, um deine Wünsche zu besprechen. Bis gleich!",
  },
  {
    title: "Nach 1–2 Tagen nachfassen",
    description:
      "Bleibt eine Reaktion aus, erinnern wir nach 2 Tagen freundlich per WhatsApp.",
    trigger: "KEINE_REAKTION",
    verzoegerungStunden: 48,
    nachricht:
      "Hallo {first_name}, wir haben dir vor Kurzem geschrieben – konntest du schon reinschauen? Melde dich gern, wenn du Fragen hast oder wir dich anrufen sollen.",
  },
  {
    title: "Nach Termin bedanken",
    description:
      "2 Stunden nach einem Termin bedanken wir uns und bleiben in Kontakt.",
    trigger: "NACH_TERMIN",
    verzoegerungStunden: 2,
    nachricht:
      "Hallo {first_name}, danke für das Gespräch heute! Wenn du noch Fragen hast, schreib uns einfach hier – wir sind für dich da.",
  },
];
