"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { PermissionModule } from "@/lib/permissions";

export type FavoriteEntityType = "candidate" | "company" | "job";

const MODULE_BY_ENTITY: Record<FavoriteEntityType, PermissionModule> = {
  candidate: "candidates",
  company: "companies",
  job: "jobs",
};

const PATH_BY_ENTITY: Record<FavoriteEntityType, string> = {
  candidate: "/kandidaten",
  company: "/unternehmen",
  job: "/stellen",
};

/**
 * Favorit für den aktuellen Mitarbeiter umschalten.
 * admin.favorite hat einen zusammengesetzten PK (employee, entity) und kein
 * deleted_at — das Entfernen der Zeile ist hier die vorgesehene Operation.
 */
export async function toggleFavorite(
  entityType: FavoriteEntityType,
  entityId: string,
): Promise<
  { ok: true; favorited: boolean } | { ok: false; message: string }
> {
  try {
    const permissionModule = MODULE_BY_ENTITY[entityType];
    if (!permissionModule) {
      return { ok: false, message: "Unbekannter Objekttyp." };
    }
    const employee = await requirePermission(permissionModule, "view");

    const removed = await sql`
      delete from admin.favorite
      where employee_id = ${employee.id}
        and entity_type = ${entityType}
        and entity_id = ${entityId}
      returning entity_id`;

    let favorited = false;
    if (removed.length === 0) {
      await sql`
        insert into admin.favorite (employee_id, entity_type, entity_id)
        values (${employee.id}, ${entityType}, ${entityId})
        on conflict do nothing`;
      favorited = true;
    }

    revalidatePath(`${PATH_BY_ENTITY[entityType]}/${entityId}`);
    return { ok: true, favorited };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Favorit konnte nicht gespeichert werden." };
  }
}
