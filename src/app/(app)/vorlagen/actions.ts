"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; message: string };

const TEMPLATE_TYPES = [
  "EMAIL",
  "NACHRICHT",
  "BEWERBUNGSANTWORT",
  "TERMINBESTAETIGUNG",
  "ANSCHREIBEN",
];

function validate(input: {
  name: string;
  type: string;
  subject: string;
  body: string;
}):
  | { name: string; type: string; subject: string | null; body: string }
  | { error: string } {
  const name = input.name.trim().slice(0, 200);
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!TEMPLATE_TYPES.includes(input.type))
    return { error: "Ungültiger Vorlagen-Typ." };
  const body = input.body.trim().slice(0, 20000);
  if (!body) return { error: "Bitte einen Inhalt angeben." };
  return {
    name,
    type: input.type,
    subject: input.subject.trim().slice(0, 300) || null,
    body,
  };
}

export async function createTemplate(input: {
  name: string;
  type: string;
  subject: string;
  body: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("templates", "create");
    const data = validate(input);
    if ("error" in data) return { ok: false, message: data.error };

    const [row] = await sql`
      insert into admin.template (name, type, subject, body)
      values (${data.name}, ${data.type}, ${data.subject}, ${data.body})
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "template.created",
      entityType: "template",
      entityId: row.id as string,
      metadata: { name: data.name, type: data.type },
    });

    revalidatePath("/vorlagen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Vorlage konnte nicht erstellt werden." };
  }
}

export async function updateTemplate(input: {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("templates", "edit");
    const data = validate(input);
    if ("error" in data) return { ok: false, message: data.error };

    await sql`
      update admin.template
      set name = ${data.name}, type = ${data.type}, subject = ${data.subject},
          body = ${data.body}, updated_at = now()
      where id = ${input.id} and deleted_at is null`;

    await recordAudit({
      actorId: employee.id,
      action: "template.updated",
      entityType: "template",
      entityId: input.id,
      metadata: { name: data.name, type: data.type },
    });

    revalidatePath("/vorlagen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Vorlage konnte nicht gespeichert werden." };
  }
}

export async function duplicateTemplate(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("templates", "create");
    const [row] = await sql`
      insert into admin.template (name, type, subject, body)
      select left(name || ' (Kopie)', 200), type, subject, body
      from admin.template
      where id = ${id} and deleted_at is null
      returning id`;
    if (!row) return { ok: false, message: "Vorlage wurde nicht gefunden." };

    await recordAudit({
      actorId: employee.id,
      action: "template.duplicated",
      entityType: "template",
      entityId: row.id as string,
      metadata: { sourceId: id },
    });

    revalidatePath("/vorlagen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Vorlage konnte nicht dupliziert werden." };
  }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("templates", "delete");
    await sql`
      update admin.template set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null`;

    await recordAudit({
      actorId: employee.id,
      action: "template.deleted",
      entityType: "template",
      entityId: id,
    });

    revalidatePath("/vorlagen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Vorlage konnte nicht gelöscht werden." };
  }
}
