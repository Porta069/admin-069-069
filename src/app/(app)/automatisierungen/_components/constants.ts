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
