"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; message: string };

export interface McpConfig {
  aktiv: boolean;
  schreiben: boolean;
}

export async function getMcpConfig(): Promise<McpConfig> {
  await requireEmployee("settings");
  const [row] = await sql`select value from admin.setting where key = 'mcp' limit 1`;
  const v = (row?.value ?? {}) as { aktiv?: boolean; schreiben?: boolean };
  // Default: aktiv und Schreiben erlaubt (bisheriges Verhalten), bis pausiert wird.
  return { aktiv: v.aktiv !== false, schreiben: v.schreiben !== false };
}

async function saveMcpConfig(next: McpConfig, actorId: string, action: string): Promise<void> {
  await sql`
    insert into admin.setting (key, value)
    values ('mcp', ${sql.json(next as never)})
    on conflict (key) do update set value = excluded.value`;
  await recordAudit({
    actorId,
    action,
    entityType: "setting",
    entityId: "mcp",
    metadata: { aktiv: next.aktiv, schreiben: next.schreiben },
  });
  revalidatePath("/einstellungen/ki");
}

/** Gesamten MCP-Zugriff pausieren/fortsetzen. */
export async function setMcpAktiv(aktiv: boolean): Promise<Result> {
  try {
    const emp = await requirePermission("settings", "edit");
    const cur = await getMcpConfig();
    await saveMcpConfig({ ...cur, aktiv }, emp.id, aktiv ? "mcp.resumed" : "mcp.paused");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Änderung fehlgeschlagen." };
  }
}

/** Schreibzugriff pausieren/fortsetzen (Lesen bleibt möglich). */
export async function setMcpSchreiben(schreiben: boolean): Promise<Result> {
  try {
    const emp = await requirePermission("settings", "edit");
    const cur = await getMcpConfig();
    await saveMcpConfig(
      { ...cur, schreiben },
      emp.id,
      schreiben ? "mcp.write_enabled" : "mcp.write_paused",
    );
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Änderung fehlgeschlagen." };
  }
}
