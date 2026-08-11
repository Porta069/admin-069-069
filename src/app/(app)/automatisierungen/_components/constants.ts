export const TRIGGERS = [
  "NEW_CANDIDATE",
  "NEW_APPLICATION",
  "NEW_JOB",
  "INTERVIEW_UPCOMING",
  "APPLICATION_STALE",
] as const;

export type AutomationTrigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  NEW_CANDIDATE: "Neuer Kandidat",
  NEW_APPLICATION: "Neue Bewerbung",
  NEW_JOB: "Neue Stelle",
  INTERVIEW_UPCOMING: "Interview steht an",
  APPLICATION_STALE: "Bewerbung unbeantwortet",
};

export const ACTION_TYPES = [
  "NOTIFY_EMPLOYEE",
  "CREATE_TASK",
  "SEND_TEMPLATE",
] as const;

export type AutomationActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  NOTIFY_EMPLOYEE: "Mitarbeiter benachrichtigen",
  CREATE_TASK: "Aufgabe erstellen",
  SEND_TEMPLATE: "Vorlage senden",
};

/**
 * Vom Runner (src/lib/sync.ts) tatsächlich unterstützte Trigger und die je
 * Trigger sinnvollen Aktionen. Alt-Trigger außerhalb dieser Liste werden in
 * der Tabelle mit „Noch ohne Runner“ gekennzeichnet.
 */
export const SUPPORTED_TRIGGERS = [
  "NEW_CANDIDATE",
  "APPLICATION_STALE",
  "INTERVIEW_UPCOMING",
] as const;

export type SupportedTrigger = (typeof SUPPORTED_TRIGGERS)[number];

export const TRIGGER_ACTIONS: Record<SupportedTrigger, AutomationActionType[]> =
  {
    NEW_CANDIDATE: ["SEND_TEMPLATE", "NOTIFY_EMPLOYEE"],
    APPLICATION_STALE: ["CREATE_TASK"],
    // Erinnerung läuft automatisch — Aktion ist fix.
    INTERVIEW_UPCOMING: ["NOTIFY_EMPLOYEE"],
  };

export function isSupportedTrigger(
  trigger: string,
): trigger is SupportedTrigger {
  return (SUPPORTED_TRIGGERS as readonly string[]).includes(trigger);
}
