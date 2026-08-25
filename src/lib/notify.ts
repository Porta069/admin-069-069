import "server-only";
import { sql } from "./db";
import { pushAnMitarbeiter } from "./ntfy";
import { entityHref, type EntityType } from "./definitions";

/**
 * Zentrale Mitteilungs-Erstellung für die Mitteilungszentrale.
 *
 * Kategorien:
 *  - SYSTEM     technische/Sicherheits-Meldungen
 *  - EREIGNIS   Ereignisse (neue Nutzer, Zuordnungen, fällige Prämien …)
 *  - PERSOENLICH von Mitarbeiter zu Mitarbeiter (mit optionalen Entity-Tags)
 *
 * Mitteilungen bleiben sichtbar, bis sie „wahrgenommen" (acknowledged) werden;
 * danach werden sie nach dem 30-s-Undo-Fenster hart gelöscht (siehe
 * raeumeWahrgenommeneMitteilungen) — der zugrunde liegende Fakt bleibt bestehen.
 */

export type MitteilungsKategorie = "SYSTEM" | "EREIGNIS" | "PERSOENLICH";

export interface MitteilungInput {
  recipientIds: string[];
  kategorie: MitteilungsKategorie;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  priority?: "NORMAL" | "HOCH" | "DRINGEND";
  senderId?: string | null;
  /** Getaggte Nutzer/Unternehmen (v. a. für persönliche Mitteilungen). */
  tags?: { entityType: string; entityId: string }[];
}

/** Erzeugt je Empfänger eine Mitteilung. Gibt die Anzahl erstellter Zeilen zurück. */
export async function sendeMitteilung(input: MitteilungInput): Promise<number> {
  const empfaenger = [...new Set(input.recipientIds.filter(Boolean))];
  if (empfaenger.length === 0) return 0;

  // Eine Zeile je Empfänger in EINEM Insert (statt N Einzel-Inserts).
  const ids = await sql`
    insert into admin.notification
      (employee_id, kategorie, type, title, body, entity_type, entity_id,
       priority, sender_employee_id)
    select rid, ${input.kategorie}, ${input.type}, ${input.title},
           ${input.body ?? null}, ${input.entityType ?? null},
           ${input.entityId ?? null}, ${input.priority ?? "NORMAL"},
           ${input.senderId ?? null}
    from unnest(${empfaenger}::uuid[]) as rid
    returning id`;

  // Tags als Kreuzprodukt (Mitteilung × Tag) in EINEM Insert.
  if (input.tags?.length && ids.length > 0) {
    const nids = ids.map((r) => r.id as string);
    const tagTypes = input.tags.map((t) => t.entityType);
    const tagIds = input.tags.map((t) => t.entityId);
    await sql`
      insert into admin.notification_tag (notification_id, entity_type, entity_id)
      select nid, tt.et, tt.eid
      from unnest(${nids}::uuid[]) as nid
      cross join unnest(${tagTypes}::text[], ${tagIds}::text[]) as tt(et, eid)
      on conflict do nothing`;
  }

  // Handy-Push (ntfy) an Empfänger mit aktivierten Handy-Benachrichtigungen.
  const clickPath =
    input.entityType && input.entityId
      ? entityHref(input.entityType as EntityType, input.entityId)
      : null;
  await pushAnMitarbeiter(empfaenger, {
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    priority: input.priority ?? "NORMAL",
    clickPath,
  });

  return ids.length;
}

const RETENTION_TAGE = 90;

/**
 * Speicher-Aufräumen. Wird vom Sync-Runner/Cron aufgerufen. Löscht NUR
 * Mitteilungs-Zeilen — nie den zugrunde liegenden Fakt (Registrierung, Zuordnung
 * etc. bleiben in ihren Tabellen). Gibt die Anzahl gelöschter Zeilen zurück.
 *
 * (a) Wahrgenommene Mitteilungen nach dem 30-s-Undo-Fenster (Kern der Zentrale).
 * (b) Retention: sehr alte Mitteilungen (älter als 90 Tage) — begrenzt das
 *     unbegrenzte Wachstum nie-wahrgenommener System-/Ereignis-Zeilen.
 */
export async function raeumeWahrgenommeneMitteilungen(): Promise<number> {
  const rows = await sql`
    delete from admin.notification
    where (acknowledged_at is not null
           and acknowledged_at < now() - interval '30 seconds')
       or created_at < now() - make_interval(days => ${RETENTION_TAGE})
    returning id`;
  return rows.length;
}
