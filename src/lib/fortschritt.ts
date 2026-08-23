import "server-only";
import { sql } from "@/lib/db";

/**
 * Prozess-Fortschritt eines Nutzers/Kandidaten: wie weit ist er in unserem
 * Ablauf? Eine EINZIGE Quelle für die überall genutzte <ProzessCounter>-Anzeige.
 *
 * Signale (alle über application_id = public."JobApplication".id):
 *  - angerufen:  admin.call_session vorhanden
 *  - angebot:    admin.proposal vorhanden (Kandidat wurde einem Job vorgeschlagen)
 *  - vermittelt: admin.placement vorhanden (nicht storniert)
 *
 * Die höchste erreichte Stufe gewinnt. Batch-fähig, damit Listen kein N+1 auslösen.
 */

export type ProzessStufe = "NEU" | "ANGERUFEN" | "ANGEBOT" | "VERMITTELT";

export interface Fortschritt {
  angerufen: boolean;
  angebot: boolean;
  vermittelt: boolean;
  stufe: ProzessStufe;
}

export const STUFEN: { key: ProzessStufe; label: string }[] = [
  { key: "NEU", label: "Neu" },
  { key: "ANGERUFEN", label: "Angerufen" },
  { key: "ANGEBOT", label: "Angebot" },
  { key: "VERMITTELT", label: "Vermittelt" },
];

function ausSignalen(f: {
  angerufen: boolean;
  angebot: boolean;
  vermittelt: boolean;
}): Fortschritt {
  const stufe: ProzessStufe = f.vermittelt
    ? "VERMITTELT"
    : f.angebot
      ? "ANGEBOT"
      : f.angerufen
        ? "ANGERUFEN"
        : "NEU";
  return { ...f, stufe };
}

/** Fortschritt für viele application_ids in EINER Abfrage. */
export async function fortschrittBatch(
  applicationIds: readonly string[],
): Promise<Map<string, Fortschritt>> {
  const ids = [...new Set(applicationIds.filter(Boolean))];
  const out = new Map<string, Fortschritt>();
  if (ids.length === 0) return out;

  const rows = await sql`
    select
      a.id as application_id,
      exists(select 1 from admin.call_session cs
             where cs.application_id = a.id and cs.deleted_at is null) as angerufen,
      exists(select 1 from admin.proposal p
             where p.application_id = a.id and p.deleted_at is null) as angebot,
      exists(select 1 from admin.placement pl
             where pl.application_id = a.id and pl.deleted_at is null
               and pl.status <> 'CANCELLED') as vermittelt
    from unnest(${ids}::text[]) as a(id)`;

  for (const r of rows) {
    out.set(
      r.application_id as string,
      ausSignalen({
        angerufen: Boolean(r.angerufen),
        angebot: Boolean(r.angebot),
        vermittelt: Boolean(r.vermittelt),
      }),
    );
  }
  return out;
}

/** Fortschritt für einen einzelnen Kandidaten. */
export async function fortschrittEinzeln(applicationId: string): Promise<Fortschritt> {
  const map = await fortschrittBatch([applicationId]);
  return map.get(applicationId) ?? ausSignalen({ angerufen: false, angebot: false, vermittelt: false });
}
