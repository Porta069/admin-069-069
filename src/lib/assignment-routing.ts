import "server-only";
import { sql } from "./db";
import { ROUTING_STEPS, type AssignmentMode } from "./assignment-steps";

export { ROUTING_STEPS, type AssignmentMode };

/**
 * Zuweisungs-Routing. In den Mitarbeiter-Einstellungen wählt man EINEN Modus:
 *  - "complete": Ein Mitarbeiter betreut den kompletten Flow. Neue Kandidaten
 *    werden reihum (Round-Robin) auf den konfigurierten Pool verteilt.
 *  - "split": Verschiedene Mitarbeiter je Schritt. Erreicht ein Kandidat einen
 *    Status, wird er automatisch dem dafür hinterlegten Mitarbeiter zugeordnet
 *    (z. B. A macht das Telefonat, danach ist automatisch B zuständig).
 *
 * Konfiguration liegt in admin.setting key 'assignment'.
 */

export interface AssignmentConfig {
  mode: AssignmentMode;
  pool: string[]; // complete: Round-Robin-Pool (Mitarbeiter-IDs)
  split: Record<string, string>; // split: Status → Mitarbeiter-ID
}

export async function getAssignmentConfig(): Promise<AssignmentConfig> {
  const [row] = await sql`select value from admin.setting where key = 'assignment'`;
  const v = (row?.value ?? {}) as Partial<AssignmentConfig>;
  return {
    mode: v.mode === "split" ? "split" : "complete",
    pool: Array.isArray(v.pool) ? v.pool.filter((x): x is string => typeof x === "string") : [],
    split:
      v.split && typeof v.split === "object"
        ? (v.split as Record<string, string>)
        : {},
  };
}

/** Nächster Empfänger aus dem Round-Robin-Pool; rückt den Zähler vor. */
async function naechsterPoolEmpfaenger(): Promise<string | null> {
  const [row] = await sql`select value from admin.setting where key = 'assignment'`;
  const v = (row?.value ?? {}) as { pool?: string[]; rr?: number };
  const pool = Array.isArray(v.pool) ? v.pool.filter((x) => typeof x === "string") : [];
  if (pool.length === 0) return null;
  const rr = typeof v.rr === "number" ? v.rr : 0;
  const pick = pool[rr % pool.length];
  await sql`
    update admin.setting
    set value = jsonb_set(coalesce(value, '{}'::jsonb), '{rr}', to_jsonb(${rr + 1}::int))
    where key = 'assignment'`;
  return pick;
}

/**
 * Wendet das Routing nach einem tatsächlichen Status-Wechsel an. Nur wenn ein
 * Zielmitarbeiter feststeht, wird `candidate_meta.assignee_id` gesetzt.
 */
export async function wendeRoutingAn(
  applicationId: string,
  status: string,
): Promise<void> {
  const cfg = await getAssignmentConfig();
  let ziel: string | null = null;
  if (cfg.mode === "split") {
    ziel = cfg.split[status] || null;
  } else if (status === "NEU") {
    // Kompletter Flow: neuer Kandidat → nächster aus dem Pool.
    ziel = await naechsterPoolEmpfaenger();
  }
  if (!ziel) return;
  await sql`
    update admin.candidate_meta
    set assignee_id = ${ziel}, updated_at = now()
    where application_id = ${applicationId} and assignee_id is distinct from ${ziel}`;
}
