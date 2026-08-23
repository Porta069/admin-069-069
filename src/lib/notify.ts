import "server-only";
import { sql } from "./db";

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

  let erstellt = 0;
  for (const rid of empfaenger) {
    const [row] = await sql`
      insert into admin.notification
        (employee_id, kategorie, type, title, body, entity_type, entity_id,
         priority, sender_employee_id)
      values (${rid}, ${input.kategorie}, ${input.type}, ${input.title},
              ${input.body ?? null}, ${input.entityType ?? null},
              ${input.entityId ?? null}, ${input.priority ?? "NORMAL"},
              ${input.senderId ?? null})
      returning id`;
    if (input.tags?.length) {
      for (const t of input.tags) {
        await sql`
          insert into admin.notification_tag (notification_id, entity_type, entity_id)
          values (${row.id}, ${t.entityType}, ${t.entityId})
          on conflict do nothing`;
      }
    }
    erstellt++;
  }
  return erstellt;
}

/**
 * Hartlöschen wahrgenommener Mitteilungen NACH dem 30-s-Undo-Fenster (spart
 * Speicher). Wird vom Sync-Runner/Cron aufgerufen. Nur die Mitteilung wird
 * gelöscht — nie der zugrunde liegende Fakt. Gibt die Anzahl gelöschter Zeilen zurück.
 */
export async function raeumeWahrgenommeneMitteilungen(): Promise<number> {
  const rows = await sql`
    delete from admin.notification
    where acknowledged_at is not null
      and acknowledged_at < now() - interval '30 seconds'
    returning id`;
  return rows.length;
}
