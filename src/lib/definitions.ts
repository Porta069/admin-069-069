/**
 * Shared domain vocabulary for the Porta Werk admin system.
 * Status values live in admin.setting where possible — the maps below carry
 * labels/appearance for known values and fall back gracefully for new ones.
 */

export type Priority = "DRINGEND" | "HOCH" | "NORMAL" | "NIEDRIG";

export const PRIORITY_LABELS: Record<Priority, string> = {
  DRINGEND: "Dringend",
  HOCH: "Hoch",
  NORMAL: "Normal",
  NIEDRIG: "Niedrig",
};

export const PRIORITIES: Priority[] = ["DRINGEND", "HOCH", "NORMAL", "NIEDRIG"];

/** Tone drives StatusBadge styling. */
export type StatusTone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

export interface StatusDef {
  label: string;
  tone: StatusTone;
}

/** Candidate pipeline (admin-side, configurable via admin.setting). */
export const CANDIDATE_STATUS: Record<string, StatusDef> = {
  NEU: { label: "Neu", tone: "info" },
  IN_BEARBEITUNG: { label: "In Bearbeitung", tone: "progress" },
  GEPRUEFT: { label: "Geprüft", tone: "progress" },
  MATCHING: { label: "Matching", tone: "progress" },
  VORGESCHLAGEN: { label: "Vorgeschlagen", tone: "progress" },
  BEWERBUNG: { label: "Bewerbung", tone: "progress" },
  INTERVIEW: { label: "Interview", tone: "warning" },
  ZUSAGE: { label: "Zusage", tone: "success" },
  VERMITTELT: { label: "Vermittelt", tone: "success" },
  ABGELEHNT: { label: "Abgelehnt", tone: "danger" },
  INAKTIV: { label: "Inaktiv", tone: "neutral" },
};

/** Platform-side Application status (backend enum ApplicationStatus). */
export const APPLICATION_STATUS: Record<string, StatusDef> = {
  SUBMITTED: { label: "Eingereicht", tone: "info" },
  IN_REVIEW: { label: "In Prüfung", tone: "progress" },
  MATCHED: { label: "Gematcht", tone: "success" },
  ARCHIVED: { label: "Archiviert", tone: "neutral" },
  ERASED: { label: "Gelöscht", tone: "danger" },
};

/** JobApplication status (backend enum JobApplicationStatus). */
export const JOB_APPLICATION_STATUS: Record<string, StatusDef> = {
  SENT: { label: "Ausstehend", tone: "info" },
  SEEN: { label: "Angesehen", tone: "progress" },
  INTERVIEW: { label: "Im Gespräch", tone: "warning" },
  ACCEPTED: { label: "Zusage", tone: "success" },
  REJECTED: { label: "Abgelehnt", tone: "danger" },
};

export const JOB_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: "Entwurf", tone: "neutral" },
  ACTIVE: { label: "Aktiv", tone: "success" },
  PAUSED: { label: "Pausiert", tone: "warning" },
  ARCHIVED: { label: "Archiviert", tone: "neutral" },
};

export const REFERRAL_STATUS: Record<string, StatusDef> = {
  REGISTERED: { label: "Registriert", tone: "info" },
  IN_PLACEMENT: { label: "In Vermittlung", tone: "progress" },
  PLACED: { label: "Vermittelt", tone: "success" },
  PAID: { label: "Ausgezahlt", tone: "neutral" },
};

export const JOB_OFFER_STATUS: Record<string, StatusDef> = {
  NEW: { label: "Neu", tone: "info" },
  ACCEPTED: { label: "Angenommen", tone: "success" },
  DECLINED: { label: "Abgelehnt", tone: "danger" },
};

export const CONTACT_REQUEST_STATUS: Record<string, StatusDef> = {
  REQUESTED: { label: "Angefragt", tone: "info" },
  APPROVED: { label: "Freigegeben", tone: "success" },
  DECLINED: { label: "Abgelehnt", tone: "danger" },
};

export const TASK_STATUS: Record<string, StatusDef> = {
  OPEN: { label: "Offen", tone: "info" },
  IN_PROGRESS: { label: "In Arbeit", tone: "progress" },
  DONE: { label: "Erledigt", tone: "success" },
  CANCELLED: { label: "Abgebrochen", tone: "neutral" },
};

export const PLACEMENT_STATUS: Record<string, StatusDef> = {
  PLACED: { label: "Vermittelt", tone: "success" },
  INVOICED: { label: "Abgerechnet", tone: "progress" },
  PAID: { label: "Bezahlt", tone: "neutral" },
  CANCELLED: { label: "Storniert", tone: "danger" },
};

export const REWARD_STATUS: Record<string, StatusDef> = {
  DUE: { label: "Fällig", tone: "warning" },
  IN_REVIEW: { label: "In Prüfung", tone: "progress" },
  PAID: { label: "Bezahlt", tone: "success" },
  CANCELLED: { label: "Storniert", tone: "neutral" },
};

export const COMPANY_STATUS: Record<string, StatusDef> = {
  NEU: { label: "Neu", tone: "info" },
  KONTAKTIERT: { label: "Kontaktiert", tone: "progress" },
  AKTIV: { label: "Aktiv", tone: "success" },
  PREMIUM: { label: "Premium", tone: "warning" },
  PAUSIERT: { label: "Pausiert", tone: "neutral" },
  INAKTIV: { label: "Inaktiv", tone: "neutral" },
};

export const EMPLOYEE_STATUS: Record<string, StatusDef> = {
  ACTIVE: { label: "Aktiv", tone: "success" },
  DISABLED: { label: "Deaktiviert", tone: "neutral" },
  LOCKED: { label: "Gesperrt", tone: "danger" },
};

/** Entity types used to link CRM objects (tasks, notes, tags, …). */
export type EntityType =
  | "candidate"
  | "company"
  | "job"
  | "application"
  | "placement"
  | "referral"
  | "partner"
  | "employee"
  | "appointment"
  | "task";

export const ENTITY_LABELS: Record<EntityType, string> = {
  candidate: "Kandidat",
  company: "Unternehmen",
  job: "Stellenanzeige",
  application: "Bewerbung",
  placement: "Vermittlung",
  referral: "Referral",
  partner: "Partner",
  employee: "Mitarbeiter",
  appointment: "Termin",
  task: "Aufgabe",
};

/** Route to an entity's detail page. */
export function entityHref(type: EntityType, id: string): string {
  switch (type) {
    case "candidate":
      return `/kandidaten/${id}`;
    case "company":
      return `/unternehmen/${id}`;
    case "job":
      return `/stellen/${id}`;
    case "application":
      return `/bewerbungen/${id}`;
    case "placement":
      return `/vermittlungen`;
    case "referral":
      return `/affiliate`;
    case "partner":
      return `/affiliate`;
    case "employee":
      return `/mitarbeiter`;
    case "appointment":
      return `/kalender`;
    case "task":
      return `/aufgaben`;
  }
}

export function statusDef(
  map: Record<string, StatusDef>,
  value: string | null | undefined,
): StatusDef {
  if (!value) return { label: "—", tone: "neutral" };
  return map[value] ?? { label: value, tone: "neutral" };
}
