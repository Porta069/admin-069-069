import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __pwSql: ReturnType<typeof postgres> | undefined;
}

/**
 * Supabase SESSION pooler (port 5432). The transaction pooler (6543) hangs
 * when postgres.js queues more queries than open connections — keep 5432.
 * All queries run server-side only; the browser never talks to the database.
 */
export const sql =
  globalThis.__pwSql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") globalThis.__pwSql = sql;
