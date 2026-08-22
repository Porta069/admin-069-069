import "server-only";
import { sql } from "@/lib/db";

/**
 * SLA-/Nachfass-Wächter. Kandidaten, die zu lange im selben aktiven
 * Pipeline-Status hängen, drohen liegen zu bleiben. Dieser Wächter erzeugt
 * dafür (idempotent) eine Nachfass-Aufgabe beim Zuständigen. Wird vom
 * Sync-Runner aufgerufen. Schwelle konfigurierbar via admin.setting key 'sla'.
 *
 * Bewusst nur für die „mittleren" Status — NEU (noch niemand dran → siehe
 * Datenqualität „ohne Zuständige") und Endzustände sind ausgenommen.
 */

const AKTIVE_STATUS = [
  "IN_BEARBEITUNG",
  "GEPRUEFT",
  "MATCHING",
  "VORGESCHLAGEN",
  "BEWERBUNG",
  "INTERVIEW",
];

const STANDARD_TAGE = 7;
const TITEL_PREFIX = "Nachfassen";

async function slaTage(): Promise<number> {
  const [row] = await sql`select value from admin.setting where key = 'sla'`;
  const v = (row?.value ?? {}) as Record<string, unknown>;
  const tage = typeof v.stale_days === "number" ? v.stale_days : STANDARD_TAGE;
  // Sicherheitsnetz: nie unter 1 Tag (sonst Aufgaben-Flut).
  return Math.max(1, Math.floor(tage));
}

/**
 * Legt für überfällige Pipeline-Kandidaten je eine offene Nachfass-Aufgabe an
 * (max. eine gleichzeitig pro Kandidat). Gibt die Anzahl neuer Aufgaben zurück.
 */
export async function erstelleSlaNachfassAufgaben(): Promise<number> {
  const tage = await slaTage();

  const faellig = await sql`
    select a.id as application_id, a."firstName", a."lastName",
           cm.status as pipeline_status, cm.assignee_id,
           extract(day from now() - cm.updated_at)::int as tage_im_status
    from admin.candidate_meta cm
    join admin.candidate a on a.id = cm.application_id
    where a.status <> 'ERASED'
      and cm.status = any(${AKTIVE_STATUS})
      and cm.updated_at < now() - make_interval(days => ${tage})
      and not exists (
        select 1 from admin.task t
        where t.entity_type = 'candidate' and t.entity_id = cm.application_id
          and t.status = 'OPEN' and t.deleted_at is null
          and t.title like ${TITEL_PREFIX + "%"}
      )
    order by cm.updated_at asc
    limit 100`;

  let erstellt = 0;
  for (const c of faellig) {
    const name =
      `${(c.firstName as string) ?? ""} ${(c.lastName as string) ?? ""}`.trim() ||
      "Kandidat";
    const tageImStatus = Number(c.tage_im_status ?? tage);
    await sql`
      insert into admin.task
        (title, description, assignee_id, due_at, priority, status, entity_type, entity_id)
      values (
        ${`${TITEL_PREFIX}: ${name}`},
        ${`${name} ist seit ${tageImStatus} Tagen im Status „${c.pipeline_status as string}" ohne Fortschritt. Bitte nachfassen oder den Status aktualisieren.`},
        ${(c.assignee_id as string | null) ?? null},
        now(), 'NORMAL', 'OPEN', 'candidate', ${c.application_id as string})`;
    erstellt++;
  }
  return erstellt;
}
