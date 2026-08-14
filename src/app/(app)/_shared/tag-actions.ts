"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { PermissionModule } from "@/lib/permissions";

export type TagEntityType = "candidate" | "company" | "job";

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

const MODULE_BY_ENTITY: Record<TagEntityType, PermissionModule> = {
  candidate: "candidates",
  company: "companies",
  job: "jobs",
};

const PATH_BY_ENTITY: Record<TagEntityType, string> = {
  candidate: "/kandidaten",
  company: "/unternehmen",
  job: "/stellen",
};

function isTagEntityType(value: string): value is TagEntityType {
  return value === "candidate" || value === "company" || value === "job";
}

function revalidateEntity(entityType: TagEntityType, entityId: string) {
  const base = PATH_BY_ENTITY[entityType];
  revalidatePath(base);
  revalidatePath(`${base}/${entityId}`);
}

/** Alle vorhandenen Tags (für das Auswahl-Popover). */
export async function listTags(): Promise<
  { ok: true; tags: Tag[] } | { ok: false; message: string }
> {
  try {
    const employee = await getEmployee();
    if (!employee) return { ok: false, message: "Nicht angemeldet." };
    const rows = await sql`
      select id, name, color from admin.tag order by name asc limit 200`;
    return {
      ok: true,
      tags: rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        color: (r.color as string | null) ?? null,
      })),
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Tags konnten nicht geladen werden." };
  }
}

/**
 * Tag an einen Datensatz hängen. Legt den Tag bei Bedarf an
 * (Name unique, lowercase-getrimmt) und upsertet die Verknüpfung.
 */
export async function addTagToEntity(
  entityType: TagEntityType,
  entityId: string,
  tagName: string,
  color?: string | null,
): Promise<{ ok: true; tag: Tag } | { ok: false; message: string }> {
  try {
    if (!isTagEntityType(entityType)) {
      return { ok: false, message: "Unbekannter Objekttyp." };
    }
    const employee = await requirePermission(
      MODULE_BY_ENTITY[entityType],
      "edit",
    );

    const name = tagName.trim().toLowerCase().slice(0, 40);
    if (!name) return { ok: false, message: "Der Tag-Name darf nicht leer sein." };
    const safeColor =
      color && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : "#64748b";

    const [tag] = await sql`
      insert into admin.tag (name, color)
      values (${name}, ${safeColor})
      on conflict (name)
      do update set color = coalesce(${safeColor}, tag.color)
      returning id, name, color`;

    await sql`
      insert into admin.entity_tag (tag_id, entity_type, entity_id)
      values (${tag.id as string}, ${entityType}, ${entityId})
      on conflict do nothing`;

    await recordAudit({
      actorId: employee.id,
      action: "tag.added",
      entityType,
      entityId,
      metadata: { tagId: tag.id as string, tag: name },
    });
    revalidateEntity(entityType, entityId);

    return {
      ok: true,
      tag: {
        id: tag.id as string,
        name: tag.name as string,
        color: (tag.color as string | null) ?? null,
      },
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Tag konnte nicht hinzugefügt werden." };
  }
}

/** Tag-Verknüpfung von einem Datensatz entfernen (der Tag selbst bleibt bestehen). */
export async function removeTagFromEntity(
  entityType: TagEntityType,
  entityId: string,
  tagId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!isTagEntityType(entityType)) {
      return { ok: false, message: "Unbekannter Objekttyp." };
    }
    const employee = await requirePermission(
      MODULE_BY_ENTITY[entityType],
      "edit",
    );

    const [tag] = await sql`select name from admin.tag where id = ${tagId}`;
    // Reine Verknüpfungstabelle ohne deleted_at — Entfernen der Zuordnung
    // ist hier die vorgesehene Operation (Tag selbst wird nie gelöscht).
    await sql`
      delete from admin.entity_tag
      where tag_id = ${tagId}
        and entity_type = ${entityType}
        and entity_id = ${entityId}`;

    await recordAudit({
      actorId: employee.id,
      action: "tag.removed",
      entityType,
      entityId,
      metadata: { tagId, tag: (tag?.name as string) ?? null },
    });
    revalidateEntity(entityType, entityId);

    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Tag konnte nicht entfernt werden." };
  }
}
