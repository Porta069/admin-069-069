"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/**
 * Führt die ADMIN-Metadaten zweier Kandidaten zusammen. Der Plattform-Datensatz
 * (public."User"/View admin.candidate) bleibt unangetastet — es werden nur die admin-seitigen
 * Verknüpfungen (Notizen, Aufgaben, Tags, Kommunikation) von der Quelle auf das
 * Ziel umgehängt, die Quelle wird als INAKTIV markiert, und ein merge_log +
 * Audit-Eintrag geschrieben.
 *
 * Technik-Hinweis wie in unternehmen/actions.ts: sql.begin ist mit der
 * db.ts-Option max_pipeline: 0 defekt, daher sql.reserve() + manuelles
 * begin/commit/rollback. Gegen die Live-DB mit ROLLBACK getestet.
 */
export async function mergeCandidates(
  sourceId: string,
  targetId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!sourceId || !targetId || sourceId === targetId) {
      return { ok: false, message: "Bitte einen Quell- und einen Ziel-Kandidaten wählen." };
    }

    const found = await sql`
      select id from admin.candidate
      where id in (${sourceId}, ${targetId}) and status <> 'ERASED'`;
    if (found.length < 2) {
      return { ok: false, message: "Quelle oder Ziel wurde nicht gefunden." };
    }

    let moved = { notes: 0, tasks: 0, comms: 0, tags: 0 };
    const tx = await sql.reserve();
    try {
      await tx.unsafe("begin");

      const nRes = await tx`
        update admin.note set entity_id = ${targetId}, updated_at = now()
        where entity_type = 'candidate' and entity_id = ${sourceId} and deleted_at is null`;
      const tRes = await tx`
        update admin.task set entity_id = ${targetId}, updated_at = now()
        where entity_type = 'candidate' and entity_id = ${sourceId} and deleted_at is null`;
      const cRes = await tx`
        update admin.communication set entity_id = ${targetId}
        where entity_type = 'candidate' and entity_id = ${sourceId} and deleted_at is null`;
      // Tags: nur die umhängen, die das Ziel noch nicht hat (PK-Konflikt vermeiden),
      // Reste auf der Quelle danach entfernen.
      const gRes = await tx`
        update admin.entity_tag et set entity_id = ${targetId}
        where et.entity_type = 'candidate' and et.entity_id = ${sourceId}
          and not exists (
            select 1 from admin.entity_tag e2
            where e2.tag_id = et.tag_id and e2.entity_type = 'candidate'
              and e2.entity_id = ${targetId})`;
      await tx`
        delete from admin.entity_tag
        where entity_type = 'candidate' and entity_id = ${sourceId}`;

      // Ziel bekommt (falls noch nicht vorhanden) eine candidate_meta-Zeile.
      await tx`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${targetId}, 'NEU', now())
        on conflict (application_id) do nothing`;
      // Quelle als INAKTIV markieren.
      await tx`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${sourceId}, 'INAKTIV', now())
        on conflict (application_id)
        do update set status = 'INAKTIV', updated_at = now()`;

      moved = {
        notes: nRes.count,
        tasks: tRes.count,
        comms: cRes.count,
        tags: gRes.count,
      };

      await tx`
        insert into admin.merge_log (entity_type, ziel_id, quelle_id, actor_id, detail)
        values ('candidate', ${targetId}, ${sourceId}, ${employee.id},
                ${sql.json(moved as never)})`;

      await tx.unsafe("commit");
    } catch (txError) {
      await tx.unsafe("rollback").catch(() => {});
      throw txError;
    } finally {
      tx.release();
    }

    await recordAudit({
      actorId: employee.id,
      action: "candidate.merged",
      entityType: "candidate",
      entityId: targetId,
      metadata: { sourceId, targetId, ...moved },
    });

    revalidatePath("/datenqualitaet");
    revalidatePath(`/kandidaten/${sourceId}`);
    revalidatePath(`/kandidaten/${targetId}`);
    return {
      ok: true,
      message: "Kandidaten zusammengeführt. Die Quelle wurde als inaktiv markiert.",
    };
  } catch (e) {
    console.error("mergeCandidates failed", e);
    return {
      ok: false,
      message: "Zusammenführen fehlgeschlagen. Bitte erneut versuchen.",
    };
  }
}

/**
 * Führt die ADMIN-Metadaten zweier Unternehmen zusammen (analog zu
 * mergeCandidates). Plattform-Datensatz (public."Company") bleibt unangetastet.
 */
export async function mergeCompanies(
  sourceId: string,
  targetId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("candidates", "edit");
    if (!sourceId || !targetId || sourceId === targetId) {
      return { ok: false, message: "Bitte ein Quell- und ein Ziel-Unternehmen wählen." };
    }

    const found = await sql`
      select id from public."Company" where id in (${sourceId}, ${targetId})`;
    if (found.length < 2) {
      return { ok: false, message: "Quelle oder Ziel wurde nicht gefunden." };
    }

    let moved = { notes: 0, tasks: 0, comms: 0, tags: 0 };
    const tx = await sql.reserve();
    try {
      await tx.unsafe("begin");

      const nRes = await tx`
        update admin.note set entity_id = ${targetId}, updated_at = now()
        where entity_type = 'company' and entity_id = ${sourceId} and deleted_at is null`;
      const tRes = await tx`
        update admin.task set entity_id = ${targetId}, updated_at = now()
        where entity_type = 'company' and entity_id = ${sourceId} and deleted_at is null`;
      const cRes = await tx`
        update admin.communication set entity_id = ${targetId}
        where entity_type = 'company' and entity_id = ${sourceId} and deleted_at is null`;
      const gRes = await tx`
        update admin.entity_tag et set entity_id = ${targetId}
        where et.entity_type = 'company' and et.entity_id = ${sourceId}
          and not exists (
            select 1 from admin.entity_tag e2
            where e2.tag_id = et.tag_id and e2.entity_type = 'company'
              and e2.entity_id = ${targetId})`;
      await tx`
        delete from admin.entity_tag
        where entity_type = 'company' and entity_id = ${sourceId}`;

      await tx`
        insert into admin.company_meta (company_id, status, updated_at)
        values (${targetId}, 'NEU', now())
        on conflict (company_id) do nothing`;
      await tx`
        insert into admin.company_meta (company_id, status, updated_at)
        values (${sourceId}, 'INAKTIV', now())
        on conflict (company_id)
        do update set status = 'INAKTIV', updated_at = now()`;

      moved = {
        notes: nRes.count,
        tasks: tRes.count,
        comms: cRes.count,
        tags: gRes.count,
      };

      await tx`
        insert into admin.merge_log (entity_type, ziel_id, quelle_id, actor_id, detail)
        values ('company', ${targetId}, ${sourceId}, ${employee.id},
                ${sql.json(moved as never)})`;

      await tx.unsafe("commit");
    } catch (txError) {
      await tx.unsafe("rollback").catch(() => {});
      throw txError;
    } finally {
      tx.release();
    }

    await recordAudit({
      actorId: employee.id,
      action: "company.merged",
      entityType: "company",
      entityId: targetId,
      metadata: { sourceId, targetId, ...moved },
    });

    revalidatePath("/datenqualitaet");
    revalidatePath(`/unternehmen/${sourceId}`);
    revalidatePath(`/unternehmen/${targetId}`);
    return {
      ok: true,
      message: "Unternehmen zusammengeführt. Die Quelle wurde als inaktiv markiert.",
    };
  } catch (e) {
    console.error("mergeCompanies failed", e);
    return {
      ok: false,
      message: "Zusammenführen fehlgeschlagen. Bitte erneut versuchen.",
    };
  }
}
