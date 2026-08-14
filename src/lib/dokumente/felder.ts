import type { FeldDef, FeldWerte } from "./typen";

/** Standard-Absender (editierbar je Dokument). */
export const SENDER_DEFAULT: FeldWerte = {
  absenderName: "PORTAWERK GmbH",
  absenderAdresse: "Handwerkstraße 1\n10115 Berlin",
  absenderKontakt: "rechnung@portawerk.de",
  absenderFuss: "PORTAWERK GmbH · USt-IdNr. DE000000000",
};

export const ABSENDER_FELDER: FeldDef[] = [
  { key: "absenderName", label: "Absender", typ: "text", gruppe: "Absender", breit: true },
  { key: "absenderAdresse", label: "Absender-Adresse", typ: "textarea", gruppe: "Absender" },
  { key: "absenderKontakt", label: "Kontakt", typ: "text", gruppe: "Absender", breit: true },
  { key: "absenderFuss", label: "Fußzeile", typ: "text", gruppe: "Absender", breit: true },
];

export const EMPFAENGER_FELDER: FeldDef[] = [
  { key: "empfaengerName", label: "Empfänger", typ: "text", gruppe: "Empfänger", breit: true },
  { key: "empfaengerAdresse", label: "Empfänger-Adresse", typ: "textarea", gruppe: "Empfänger" },
];

export const KOPF_FELDER: FeldDef[] = [
  { key: "titel", label: "Titel", typ: "text", gruppe: "Dokument" },
  { key: "nummer", label: "Nummer / Kennung", typ: "text", gruppe: "Dokument" },
  { key: "datum", label: "Datum", typ: "text", gruppe: "Dokument" },
  { key: "betreff", label: "Betreff", typ: "text", gruppe: "Dokument", breit: true },
];

export const TEXT_FELDER: FeldDef[] = [
  { key: "einleitung", label: "Einleitung / Text", typ: "textarea", gruppe: "Text" },
  { key: "schluss", label: "Schluss / Hinweise", typ: "textarea", gruppe: "Text" },
];

export const STEUER_FELD: FeldDef = {
  key: "steuersatz",
  label: "USt (%)",
  typ: "number",
  gruppe: "Zahlung",
};

/** Felder für Belege mit Positionen (Rechnung, Mahnung). */
export const RECHNUNG_FELDER: FeldDef[] = [
  ...ABSENDER_FELDER,
  ...EMPFAENGER_FELDER,
  ...KOPF_FELDER,
  ...TEXT_FELDER,
  STEUER_FELD,
];

/** Felder für reine Schreiben ohne Positionen (Anschreiben, AGB-Update …). */
export const BRIEF_FELDER: FeldDef[] = [
  ...ABSENDER_FELDER,
  ...EMPFAENGER_FELDER,
  ...KOPF_FELDER,
  ...TEXT_FELDER,
];
