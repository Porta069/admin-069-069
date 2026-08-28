import "server-only";

/**
 * Obsolet seit dem Funnel-Umbau: Es gibt keine losen `survey_`/`ai_`-Antworten
 * mehr — das gesamte Fachprofil liegt in typisierten CraftProfile-Spalten und
 * wird über `profilAnzeige` (src/lib/matching/anzeige.ts) vollständig angezeigt.
 * Der Stub bleibt, bis der letzte Aufrufer umgestellt ist.
 */

export interface ZusatzAntwort {
  label: string;
  werte: string[];
}

export function zusatzAntworten(_profil?: unknown): ZusatzAntwort[] {
  void _profil;
  return [];
}
