"use server";

import { revalidatePath } from "next/cache";
import { getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sanitizeWidgets } from "./widgets";

/**
 * Persönliche Dashboard-Konfiguration speichern (reine Präferenz — kein
 * Audit nötig). Das Dashboard ist für jeden angemeldeten Mitarbeiter
 * sichtbar, daher genügt der Login als Berechtigung.
 */
export async function saveDashboardConfig(
  widgets: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const employee = await getEmployee();
    if (!employee) {
      return { ok: false, message: "Nicht angemeldet." };
    }

    const clean = sanitizeWidgets(widgets) ?? [];
    await sql`
      insert into admin.dashboard_config (employee_id, widgets, updated_at)
      values (${employee.id}, ${sql.json(clean)}, now())
      on conflict (employee_id)
      do update set widgets = ${sql.json(clean)}, updated_at = now()`;

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: "Die Dashboard-Einstellungen konnten nicht gespeichert werden.",
    };
  }
}
