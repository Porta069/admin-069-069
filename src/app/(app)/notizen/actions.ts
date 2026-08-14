"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; message: string };

async function knownCategories(): Promise<string[]> {
  const rows = await sql`
    select value from admin.setting where key = 'note_categories'`;
  const value = rows[0]?.value;
  return Array.isArray(value) ? (value as string[]) : [];
}

async function resolveCategory(
  raw: string,
  allowNew: boolean,
): Promise<string | null> {
  const category = raw.trim().toUpperCase().slice(0, 60);
  if (!category) return "ALLGEMEIN";
  const known = await knownCategories();
  if (known.includes(category)) return category;
  if (!allowNew) return null;
  await sql`
    update admin.setting
    set value = ${sql.json([...known, category])}, updated_at = now()
    where key = 'note_categories'`;
  return category;
}

export async function createNote(input: {
  content: string;
  category: string;
  entityType: string;
  entityId: string;
  pinned: boolean;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("notes", "create");
    const content = input.content.trim().slice(0, 10000);
    if (!content) return { ok: false, message: "Bitte einen Inhalt angeben." };

    const category = await resolveCategory(
      input.category,
      can(employee, "notes", "manage"),
    );
    if (!category)
      return {
        ok: false,
        message: "Neue Kategorien dürfen nur mit der Berechtigung „Verwalten“ angelegt werden.",
      };

    const entityType =
      input.entityType === "candidate" || input.entityType === "company"
        ? input.entityType
        : null;
    const entityId = entityType && input.entityId ? input.entityId : null;

    const [note] = await sql`
      insert into admin.note (content, category, author_id, entity_type, entity_id, pinned)
      values (${content}, ${category}, ${employee.id}, ${entityType}, ${entityId}, ${Boolean(input.pinned)})
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "note.created",
      entityType: entityType ?? "note",
      entityId: entityId ?? (note.id as string),
      metadata: { category, pinned: Boolean(input.pinned) },
    });

    revalidatePath("/notizen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht erstellt werden." };
  }
}

async function requireNoteAccess(
  noteId: string,
  action: "edit" | "delete",
): Promise<{ employeeId: string } | { error: string }> {
  const employee = await requirePermission("notes", action);
  const [note] = await sql`
    select author_id from admin.note where id = ${noteId} and deleted_at is null`;
  if (!note) return { error: "Notiz wurde nicht gefunden." };
  if (
    note.author_id !== employee.id &&
    !can(employee, "notes", "manage")
  ) {
    return { error: "Nur eigene Notizen können bearbeitet werden." };
  }
  return { employeeId: employee.id };
}

export async function updateNote(input: {
  id: string;
  content: string;
  category: string;
}): Promise<ActionResult> {
  try {
    const access = await requireNoteAccess(input.id, "edit");
    if ("error" in access) return { ok: false, message: access.error };

    const content = input.content.trim().slice(0, 10000);
    if (!content) return { ok: false, message: "Bitte einen Inhalt angeben." };
    const known = await knownCategories();
    const category = input.category.trim().toUpperCase().slice(0, 60);
    const finalCategory = known.includes(category) ? category : "ALLGEMEIN";

    await sql`
      update admin.note
      set content = ${content}, category = ${finalCategory}, updated_at = now()
      where id = ${input.id} and deleted_at is null`;

    await recordAudit({
      actorId: access.employeeId,
      action: "note.updated",
      entityType: "note",
      entityId: input.id,
      metadata: { category: finalCategory },
    });

    revalidatePath("/notizen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gespeichert werden." };
  }
}

export async function toggleNotePin(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  try {
    const access = await requireNoteAccess(id, "edit");
    if ("error" in access) return { ok: false, message: access.error };
    await sql`
      update admin.note set pinned = ${pinned}, updated_at = now()
      where id = ${id} and deleted_at is null`;
    await recordAudit({
      actorId: access.employeeId,
      action: pinned ? "note.pinned" : "note.unpinned",
      entityType: "note",
      entityId: id,
    });
    revalidatePath("/notizen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aktion fehlgeschlagen." };
  }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  try {
    const access = await requireNoteAccess(id, "delete");
    if ("error" in access) return { ok: false, message: access.error };

    await sql`
      update admin.note set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null`;

    await recordAudit({
      actorId: access.employeeId,
      action: "note.deleted",
      entityType: "note",
      entityId: id,
    });

    revalidatePath("/notizen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gelöscht werden." };
  }
}
