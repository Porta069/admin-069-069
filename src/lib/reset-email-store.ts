import "server-only";
import { sql } from "@/lib/db";
import {
  DEFAULT_RESET_EMAIL,
  mitDefaults,
  type ResetEmailConfig,
} from "./reset-email";

const KEY = "reset_email";

/** Gespeicherte Reset-Mail-Konfiguration (mit Default aufgefüllt). */
export async function getResetEmailConfig(): Promise<ResetEmailConfig> {
  const [row] = await sql`select value from admin.setting where key = ${KEY} limit 1`;
  return mitDefaults((row?.value as Partial<ResetEmailConfig> | undefined) ?? null);
}

export async function saveResetEmailConfig(cfg: ResetEmailConfig): Promise<void> {
  await sql`
    insert into admin.setting (key, value)
    values (${KEY}, ${sql.json(cfg as never)})
    on conflict (key) do update set value = excluded.value`;
}

/** Auf den fest hinterlegten Standard zurücksetzen (Eintrag entfernen). */
export async function resetResetEmailConfig(): Promise<void> {
  await sql`delete from admin.setting where key = ${KEY}`;
}

export { DEFAULT_RESET_EMAIL };
