import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __pwSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Supabase TRANSACTION pooler (port 6543) — richtig für Serverless
 * (200 Client-Verbindungen; der Session-Pooler kappt bei pool_size=15).
 * Zwei Pflicht-Optionen für Supavisor im Transaction-Modus:
 *   prepare: false       (keine benannten Prepared Statements)
 *   max_pipeline: 0      (kein Pipelining — sonst hängen gequeute Queries)
 * All queries run server-side only; the browser never talks to the database.
 */
export const sql =
  globalThis.__pwSql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // max_pipeline fehlt in den Typdefinitionen, existiert aber zur Laufzeit.
    max_pipeline: 0,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // Sicherheitsnetz gegen Endlos-/DoS-Queries (z. B. über den MCP-Server):
    // kein einzelnes Statement blockiert eine Pool-Verbindung länger als 30 s.
    // Alle regulären Dashboard-Queries sind weit darunter.
    connection: { statement_timeout: 30000 },
  } as unknown as postgres.Options<Record<string, never>>);

if (process.env.NODE_ENV !== "production") globalThis.__pwSql = sql;
