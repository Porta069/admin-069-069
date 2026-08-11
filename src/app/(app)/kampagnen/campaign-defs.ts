/**
 * Modul-lokales Vokabular für Kampagnen & Rundmails.
 * Status-Maps folgen dem StatusBadge-Muster aus @/lib/definitions.
 */
import type { StatusDef } from "@/lib/definitions";

export const CAMPAIGN_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: "Entwurf", tone: "neutral" },
  SCHEDULED: { label: "Geplant", tone: "info" },
  SENDING: { label: "Wird versendet", tone: "progress" },
  SENT: { label: "Versendet", tone: "success" },
  CANCELLED: { label: "Abgebrochen", tone: "danger" },
};

export const OUTBOX_STATUS: Record<string, StatusDef> = {
  PENDING: { label: "Wartend", tone: "info" },
  SENT: { label: "Versendet", tone: "success" },
  FAILED: { label: "Fehlgeschlagen", tone: "danger" },
  SKIPPED: { label: "Übersprungen", tone: "neutral" },
};

export type AudienceTyp = "kandidaten" | "unternehmen" | "partner";

export interface Audience {
  typ: AudienceTyp;
  /** Kandidaten-Filter */
  bundesland?: string | null;
  beruf?: string | null;
  verifiziert?: boolean;
  /** Unternehmen-Filter */
  ort?: string | null;
}

export const AUDIENCE_TYP_LABELS: Record<AudienceTyp, string> = {
  kandidaten: "Kandidaten",
  unternehmen: "Unternehmen",
  partner: "Partner",
};

/** "Kandidaten · Bayern · Elektriker · nur Verifizierte" */
export function formatAudience(raw: unknown): string {
  const a = (raw ?? {}) as Partial<Audience>;
  switch (a.typ) {
    case "kandidaten": {
      const parts = ["Kandidaten"];
      if (a.bundesland) parts.push(a.bundesland);
      if (a.beruf) parts.push(a.beruf);
      if (a.verifiziert) parts.push("nur Verifizierte");
      return parts.join(" · ");
    }
    case "unternehmen": {
      const parts = ["Unternehmen"];
      if (a.ort) parts.push(a.ort);
      return parts.join(" · ");
    }
    case "partner":
      return "Partner";
    default:
      return "—";
  }
}

/** Unterstützte Template-Variablen (siehe renderTemplate in @/lib/mailer). */
export const TEMPLATE_VARS = [
  "{first_name}",
  "{last_name}",
  "{company}",
  "{job_title}",
] as const;

/** Beispielwerte für die Vorschau. */
export const SAMPLE_VARS: Record<string, string> = {
  first_name: "Max",
  last_name: "Mustermann",
  company: "Muster Bau GmbH",
  job_title: "Elektriker (m/w/d)",
};

/** Maximale Empfängerzahl pro Kampagne. */
export const MAX_RECIPIENTS = 2000;
