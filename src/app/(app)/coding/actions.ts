"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; message: string };

async function master() {
  const employee = await requireEmployee();
  if (employee.roleId !== "SUPERADMIN") {
    throw new Error("Nur für das Master-Konto.");
  }
  return employee;
}

/** Einen Checklisten-Punkt ab-/anhaken. */
export async function toggleCodingTask(
  id: string,
  erledigt: boolean,
): Promise<Result> {
  try {
    await master();
    await sql`
      update admin.coding_task
      set erledigt = ${erledigt}, erledigt_at = ${erledigt ? sql`now()` : null}
      where id = ${id}::uuid and deleted_at is null`;
    revalidatePath("/coding");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Konnte nicht gespeichert werden." };
  }
}

/** Neuen Punkt hinzufügen. */
export async function addCodingTask(input: {
  titel: string;
  kategorie?: string;
  prioritaet?: string;
  beschreibung?: string;
}): Promise<Result> {
  try {
    const employee = await master();
    const titel = (input.titel ?? "").trim().slice(0, 200);
    if (!titel) return { ok: false, message: "Bitte einen Titel angeben." };
    const prioritaet =
      input.prioritaet && ["HIGH", "MEDIUM", "LOW"].includes(input.prioritaet)
        ? input.prioritaet
        : "MEDIUM";
    const kategorie = (input.kategorie ?? "").trim().slice(0, 60) || "Allgemein";
    await sql`
      insert into admin.coding_task (titel, beschreibung, kategorie, prioritaet, created_by)
      values (${titel}, ${(input.beschreibung ?? "").trim().slice(0, 500) || null},
              ${kategorie}, ${prioritaet}, ${employee.id})`;
    revalidatePath("/coding");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Konnte nicht angelegt werden." };
  }
}

/** Punkt entfernen (Soft-Delete). */
export async function deleteCodingTask(id: string): Promise<Result> {
  try {
    const employee = await master();
    await sql`
      update admin.coding_task set deleted_at = now()
      where id = ${id}::uuid and deleted_at is null`;
    await recordAudit({
      actorId: employee.id,
      action: "coding.task_deleted",
      entityType: "coding_task",
      entityId: id,
    });
    revalidatePath("/coding");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Konnte nicht entfernt werden." };
  }
}
