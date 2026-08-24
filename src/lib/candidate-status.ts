import "server-only";
import { sql } from "./db";
import { wendeRoutingAn } from "./assignment-routing";

/**
 * Automatische Übergänge des (einzigen) Kandidaten-Status `candidate_meta.status`.
 *
 * Nur drei Ereignisse setzen automatisch:
 *  - Registrierung  → NEU          (nur wenn noch kein Status existiert)
 *  - Telefonat      → ANGERUFEN    (nur aus NEU / ohne Status — kein Rückschritt)
 *  - Job-Zuordnung  → ABWICKLUNG   (aus frühen Stufen — nicht aus Endzuständen)
 *
 * Alle übrigen Status (inkl. INAKTIV) werden ausschließlich manuell gesetzt.
 */

/** Aktive Bearbeitungsstufen (weder neu noch abgeschlossen). */
export const AKTIVE_KANDIDAT_STATUS = ["ANGERUFEN", "MATCHING", "ABWICKLUNG", "BEWERBUNG"];
/** Endzustände — hier greift keine Auto-Weiterschaltung und keine Nachfass-Logik. */
export const TERMINALE_KANDIDAT_STATUS = ["ANGENOMMEN", "ABGELEHNT", "KEIN_INTERESSE", "INAKTIV"];

/**
 * Setzt den Status auf `ziel` — aber nur, wenn noch kein Status existiert ODER
 * der aktuelle Status in `vorgaenger` liegt. So werden manuelle/spätere Stufen
 * nie automatisch überschrieben. `vorgaenger = []` ⇒ nur beim Neuanlegen/`null`.
 */
export async function autoKandidatStatus(
  applicationId: string,
  ziel: string,
  vorgaenger: string[],
): Promise<void> {
  const rows = await sql`
    insert into admin.candidate_meta (application_id, status, updated_at)
    values (${applicationId}, ${ziel}, now())
    on conflict (application_id) do update
      set status = ${ziel}, updated_at = now()
      where admin.candidate_meta.status is null
         or admin.candidate_meta.status = any(${vorgaenger}::text[])
    returning application_id`;
  // Nur bei tatsächlichem Statuswechsel das Zuweisungs-Routing anwenden.
  if (rows.length > 0) {
    await wendeRoutingAn(applicationId, ziel);
  }
}
