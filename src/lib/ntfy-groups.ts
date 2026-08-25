/**
 * Push-Gruppen für Handy-Benachrichtigungen (ntfy). Isomorph (kein server-only),
 * damit sowohl die Konto-Checkliste als auch die Server-Zustellung dieselbe
 * Zuordnung nutzen. Jeder Notification-`type` fällt in genau eine Gruppe; der
 * Mitarbeiter kann Gruppen einzeln abwählen (Default: alle an).
 */

export interface PushGruppe {
  key: string;
  label: string;
  description: string;
}

export const PUSH_GRUPPEN: PushGruppe[] = [
  { key: "chat", label: "Chat-Nachrichten", description: "Direktnachrichten von Kolleg:innen" },
  { key: "new_candidate", label: "Neue Registrierungen", description: "Wenn sich ein Handwerker registriert" },
  { key: "new_application", label: "Neue Bewerbungen", description: "Eingehende Bewerbungen auf Stellen" },
  { key: "new_job", label: "Neue Stellen", description: "Neu angelegte Stellenangebote" },
  { key: "assignment", label: "Zuweisungen an mich", description: "Wenn dir ein Kandidat/Unternehmen zugewiesen wird" },
  { key: "task", label: "Aufgaben", description: "Neue Aufgaben & Zuweisungen" },
  { key: "appointment", label: "Termine & Erinnerungen", description: "Anstehende und verpasste Termine" },
  { key: "personal", label: "Persönliche Mitteilungen", description: "Direkte Mitteilungen aus der Zentrale" },
  { key: "system", label: "System & Sicherheit", description: "Technische und sicherheitsrelevante Hinweise" },
];

export const PUSH_GRUPPEN_KEYS = PUSH_GRUPPEN.map((g) => g.key);

/** Notification-`type` → Gruppen-Key. Unbekanntes fällt in „system" (nie stumm). */
export function typZuGruppe(type: string | null | undefined): string {
  const t = (type ?? "").toUpperCase();
  if (t === "CHAT") return "chat";
  if (t === "NEW_CANDIDATE") return "new_candidate";
  if (t === "NEW_APPLICATION") return "new_application";
  if (t === "NEW_JOB") return "new_job";
  if (t === "ASSIGNMENT") return "assignment";
  if (t.startsWith("TASK")) return "task";
  if (t.startsWith("APPOINTMENT")) return "appointment";
  if (t === "PERSOENLICH") return "personal";
  return "system";
}

export type NtfyPrefs = Record<string, boolean> | null | undefined;

/** Gruppe aktiv? Default an — nur ein explizites `false` schaltet sie ab. */
export function istGruppeAktiv(prefs: NtfyPrefs, gruppe: string): boolean {
  if (!prefs) return true;
  return prefs[gruppe] !== false;
}

/** Vollständige Prefs-Map aus (evtl. lückenhaften) gespeicherten Werten. */
export function normalisierePrefs(prefs: NtfyPrefs): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const g of PUSH_GRUPPEN) out[g.key] = istGruppeAktiv(prefs, g.key);
  return out;
}
