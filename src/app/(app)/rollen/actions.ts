"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  isFullAccess,
  permissionsSubsetOf,
  buildPermissionMap,
} from "@/lib/rbac";

const KNOWN = new Set(["Nicht angemeldet.", "Keine Berechtigung für diese Aktion."]);
const msg = (e: unknown, f: string) =>
  e instanceof Error && KNOWN.has(e.message) ? e.message : f;

export interface TemplateInput {
  name: string;
  description: string;
  icon: string;
  level: number;
  selection: Record<string, string[]>;
}

function slugFromName(name: string): string {
  return (
    name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) ||
    "TEMPLATE"
  );
}

async function eindeutigeId(base: string): Promise<string> {
  let id = base;
  for (let i = 2; i < 50; i++) {
    const [ex] = await sql`select 1 from admin.role where id = ${id} limit 1`;
    if (!ex) return id;
    id = `${base}_${i}`;
  }
  return `${base}_${Date.now()}`;
}

/** Gemeinsame Prüfungen für Level + Rechteumfang (kein Privilege-Escalation). */
function pruefeUmfang(
  actor: { roleLevel: number; permissions: Record<string, string[]> },
  level: number,
  map: Record<string, string[]>,
): string | null {
  const master = isFullAccess(actor.permissions);
  if (!master && level >= actor.roleLevel) {
    return "Du kannst kein Template mit gleich hoher oder höherer Stufe erstellen.";
  }
  if (!permissionsSubsetOf(map, actor.permissions)) {
    return "Ein Template darf nur Rechte enthalten, die du selbst besitzt.";
  }
  return null;
}

export async function createTemplate(
  input: TemplateInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("roles", "create");
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, message: "Bitte einen Namen angeben." };
    const level = Math.max(1, Math.min(99, Math.round(input.level || 20)));
    const map = buildPermissionMap(input.selection);
    const fehler = pruefeUmfang(actor, level, map);
    if (fehler) return { ok: false, message: fehler };

    const id = await eindeutigeId(slugFromName(name));
    await sql`
      insert into admin.role (id, name, description, icon, level, permissions, is_system, created_by, updated_at)
      values (${id}, ${name}, ${input.description.trim() || null}, ${input.icon.trim() || null},
              ${level}, ${sql.json(map as never)}, false, ${actor.id}, now())`;
    await recordAudit({
      actorId: actor.id, action: "role.created", entityType: "role", entityId: id,
      metadata: { name, level, modules: Object.keys(map) },
    });
    revalidatePath("/rollen");
    return { ok: true, id };
  } catch (e) {
    console.error(e);
    return { ok: false, message: msg(e, "Template konnte nicht erstellt werden.") };
  }
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("roles", "edit");
    const [role] = await sql`select id, is_system, level from admin.role where id = ${id} limit 1`;
    if (!role) return { ok: false, message: "Template wurde nicht gefunden." };
    if (role.is_system) return { ok: false, message: "System-Rollen können nicht bearbeitet werden." };

    const name = input.name.trim();
    if (name.length < 2) return { ok: false, message: "Bitte einen Namen angeben." };
    const level = Math.max(1, Math.min(99, Math.round(input.level || 20)));
    const map = buildPermissionMap(input.selection);
    const fehler = pruefeUmfang(actor, level, map);
    if (fehler) return { ok: false, message: fehler };

    await sql`
      update admin.role set name = ${name}, description = ${input.description.trim() || null},
        icon = ${input.icon.trim() || null}, level = ${level},
        permissions = ${sql.json(map as never)}, updated_at = now()
      where id = ${id}`;
    await recordAudit({
      actorId: actor.id, action: "role.updated", entityType: "role", entityId: id,
      metadata: { name, level },
    });
    revalidatePath("/rollen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: msg(e, "Template konnte nicht gespeichert werden.") };
  }
}

export async function deleteTemplate(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("roles", "delete");
    const [role] = await sql`select id, is_system from admin.role where id = ${id} limit 1`;
    if (!role) return { ok: false, message: "Template wurde nicht gefunden." };
    if (role.is_system) return { ok: false, message: "System-Rollen können nicht gelöscht werden." };
    const [used] = await sql`
      select count(*)::int c from admin.employee where role_id = ${id} and deleted_at is null`;
    if ((used.c as number) > 0) {
      return { ok: false, message: `Template ist noch ${used.c} Mitarbeitern zugewiesen — bitte zuerst umziehen.` };
    }
    await sql`delete from admin.role where id = ${id}`;
    await recordAudit({ actorId: actor.id, action: "role.deleted", entityType: "role", entityId: id });
    revalidatePath("/rollen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: msg(e, "Template konnte nicht gelöscht werden.") };
  }
}
