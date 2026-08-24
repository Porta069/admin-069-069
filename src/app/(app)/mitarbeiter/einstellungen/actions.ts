"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

/** Zuweisungs-Routing speichern (Modus + Pool + Schritt-Zuordnung). */
export async function saveAssignmentConfig(input: {
  mode: "complete" | "split";
  pool: string[];
  split: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("employees", "manage");
    const mode = input.mode === "split" ? "split" : "complete";
    const pool = [...new Set((input.pool ?? []).filter(Boolean))];
    const split: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.split ?? {})) {
      if (typeof v === "string" && v) split[k] = v;
    }
    const value = { mode, pool, split };
    // `||` merged auf oberster Ebene — behält den rr-Zähler (Round-Robin).
    await sql`
      insert into admin.setting (key, value)
      values ('assignment', ${sql.json(value)})
      on conflict (key) do update set value = admin.setting.value || ${sql.json(value)}`;
    await recordAudit({
      actorId: employee.id,
      action: "assignment.config_saved",
      entityType: "setting",
      entityId: "assignment",
      metadata: { mode, poolSize: pool.length, steps: Object.keys(split).length },
    });
    revalidatePath("/mitarbeiter/einstellungen");
    return { ok: true };
  } catch (e) {
    console.error("saveAssignmentConfig failed", e);
    return { ok: false, message: "Speichern fehlgeschlagen." };
  }
}
