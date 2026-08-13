"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/**
 * Legt eine Wiederholungsgeschäft-Follow-up-Aufgabe für ein Unternehmen an,
 * das bereits erfolgreich vermittelt hat, aber aktuell keine offene Stelle hat.
 */
export async function createFollowupTask(
  companyId: string,
  companyName: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    if (!companyId) return { ok: false, message: "Kein Unternehmen angegeben." };

    const [company] = await sql`
      select name from public."Company" where id = ${companyId} limit 1`;
    if (!company) return { ok: false, message: "Unternehmen nicht gefunden." };

    const name = (company.name as string) || companyName;
    await sql`
      insert into admin.task
        (title, description, assignee_id, creator_id, due_at, priority, status,
         entity_type, entity_id)
      values
        (${`Follow-up: ${name}`},
         ${"Zufriedener Bestandskunde ohne offene Stelle — nach neuem Bedarf fragen (Wiederholungsgeschäft)."},
         ${employee.id}, ${employee.id}, now() + interval '5 days', 'NORMAL', 'OPEN',
         'company', ${companyId})`;

    await recordAudit({
      actorId: employee.id,
      action: "company.followup_task_created",
      entityType: "company",
      entityId: companyId,
      metadata: { title: `Follow-up: ${name}` },
    });

    revalidatePath("/analytics");
    revalidatePath(`/unternehmen/${companyId}`);
    revalidatePath("/aufgaben");
    return { ok: true, message: "Follow-up-Aufgabe angelegt." };
  } catch (e) {
    console.error("createFollowupTask failed", e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}
