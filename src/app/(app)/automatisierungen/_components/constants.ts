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
 * Alle anlegbaren Trigger und die je Trigger sinnvollen Aktionen. Der Runner
 * (src/lib/sync.ts) führt sie aus; nicht jede Kombination erzeugt zwingend
 * sofort einen Effekt (die Auswertung zeigt „Treffer/Ausgeführt" je Lauf).
 */
export const SUPPORTED_TRIGGERS = [
  "NEW_CANDIDATE",
  "NEW_APPLICATION",
  "NEW_JOB",
  "APPLICATION_STALE",
  "INTERVIEW_UPCOMING",
] as const;

export type SupportedTrigger = (typeof SUPPORTED_TRIGGERS)[number];

export const TRIGGER_ACTIONS: Record<SupportedTrigger, AutomationActionType[]> = {
  NEW_CANDIDATE: ["SEND_TEMPLATE", "CREATE_TASK"],
  NEW_APPLICATION: ["CREATE_TASK", "SEND_TEMPLATE"],
  NEW_JOB: ["CREATE_TASK"],
  APPLICATION_STALE: ["CREATE_TASK"],
  INTERVIEW_UPCOMING: ["NOTIFY_EMPLOYEE"],
};

export function isSupportedTrigger(
  trigger: string,
): trigger is SupportedTrigger {
  return (SUPPORTED_TRIGGERS as readonly string[]).includes(trigger);
}
