"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { sendeMitteilung } from "@/lib/notify";
import * as backend from "@/lib/backend";
import {
  COMPANY_STATUS,
  PRIORITIES,
  statusDef,
  type Priority,
} from "@/lib/definitions";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const STATUSES = Object.keys(COMPANY_STATUS);
const CHANNELS = ["EMAIL", "TELEFON", "WHATSAPP", "SONSTIGE"];
const DIRECTIONS = ["INBOUND", "OUTBOUND"];

function revalidateCompany(companyId?: string) {
  revalidatePath("/unternehmen");
  if (companyId) revalidatePath(`/unternehmen/${companyId}`);
}

// ── Unternehmen anlegen (über Render-Backend) ────────────────────────────

export interface CreateCompanyPayload {
  name: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  kontaktName?: string;
  kontaktEmail?: string;
  kontaktTelefon?: string;
  website?: string;
}

export async function createCompany(
  payload: CreateCompanyPayload,
): Promise<ActionResult> {
  let employeeId: string | null = null;
  try {
    const employee = await requirePermission("companies", "create");
    employeeId = employee.id;
    const name = payload.name?.trim();
    if (!name) return { ok: false, message: "Bitte einen Firmennamen angeben." };

    const clean = {
      name,
      strasse: payload.strasse?.trim() || undefined,
      plz: payload.plz?.trim() || undefined,
      ort: payload.ort?.trim() || undefined,
      kontaktName: payload.kontaktName?.trim() || undefined,
      kontaktEmail: payload.kontaktEmail?.trim() || undefined,
      kontaktTelefon: payload.kontaktTelefon?.trim() || undefined,
      website: payload.website?.trim() || undefined,
    };

    const result = (await backend.adminCreateCompany(clean)) as
      | { id?: string; company?: { id?: string } }
      | undefined;
    const companyId = result?.id ?? result?.company?.id ?? null;

    await recordAudit({
      actorId: employee.id,
      action: "company.created",
      entityType: "company",
      entityId: companyId,
      metadata: { name },
    });
    revalidateCompany();
    return { ok: true, message: `Unternehmen „${name}" wurde angelegt.` };
  } catch (e) {
    console.error("createCompany failed", e, { employeeId });
    return {
      ok: false,
      message:
        "Anlegen fehlgeschlagen — das Backend wacht möglicherweise gerade auf. Bitte kurz erneut versuchen.",
    };
  }
}

// ── Löschen / Archivieren ────────────────────────────────────────────────

export interface CompanyDeletionInfo {
  ok: true;
  name: string;
  jobs: number;
  applications: number;
  offers: number;
  jobFavorites: number;
  contactRequests: number;
  placements: number;
  archived: boolean;
  /** Endgültiges Löschen: nur SUPERADMIN und nur ohne Verknüpfungen. */
  canHardDelete: boolean;
  isSuperadmin: boolean;
}

/**
 * Konsequenzen-Zusammenfassung für den Lösch-Dialog (echte Counts).
 */
export async function getCompanyDeletionInfo(
  companyId: string,
): Promise<CompanyDeletionInfo | { ok: false; message: string }> {
  try {
    const employee = await requirePermission("companies", "delete");
    const rows = await sql`
      select c.name, cm.archived_at,
        (select count(*)::int from public."JobPosting" j
         where j."companyId" = c.id) as jobs,
        (select count(*)::int from public."JobApplication" ja
         join public."JobPosting" j on j.id = ja."jobPostingId"
         where j."companyId" = c.id) as applications,
        (select count(*)::int from public."JobOffer" o
         join public."JobPosting" j on j.id = o."jobPostingId"
         where j."companyId" = c.id) as offers,
        (select count(*)::int from public."Favorite" f
         join public."JobPosting" j on j.id = f."jobPostingId"
         where j."companyId" = c.id) as job_favorites,
        (select count(*)::int from public."ContactRequest" cr
         where cr."companyId" = c.id) as contact_requests,
        (select count(*)::int from admin.placement p
         where p.company_id = c.id and p.deleted_at is null) as placements
      from public."Company" c
      left join admin.company_meta cm on cm.company_id = c.id
      where c.id = ${companyId}
      limit 1`;
    const row = rows[0];
    if (!row) return { ok: false, message: "Unternehmen nicht gefunden." };

    const isSuperadmin = employee.roleId === "SUPERADMIN";
    const blocked =
      (row.applications as number) > 0 ||
      (row.placements as number) > 0 ||
      (row.offers as number) > 0 ||
      (row.job_favorites as number) > 0;

    return {
      ok: true,
      name: row.name as string,
      jobs: row.jobs as number,
      applications: row.applications as number,
      offers: row.offers as number,
      jobFavorites: row.job_favorites as number,
      contactRequests: row.contact_requests as number,
      placements: row.placements as number,
      archived: row.archived_at != null,
      isSuperadmin,
      canHardDelete: isSuperadmin && !blocked,
    };
  } catch (e) {
    console.error("getCompanyDeletionInfo failed", e);
    return { ok: false, message: "Daten konnten nicht geladen werden." };
  }
}

/** Archivieren (empfohlen): verschwindet aus der Standardliste, bleibt erhalten. */
export async function archiveCompany(companyId: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "delete");
    const rows = await sql`
      select name from public."Company" where id = ${companyId} limit 1`;
    if (!rows[0]) return { ok: false, message: "Unternehmen nicht gefunden." };
    await sql`
      insert into admin.company_meta (company_id, status, archived_at, updated_at)
      values (${companyId}, 'INAKTIV', now(), now())
      on conflict (company_id)
      do update set status = 'INAKTIV', archived_at = now(), updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "company.archived",
      entityType: "company",
      entityId: companyId,
      metadata: { name: rows[0].name as string },
    });
    revalidateCompany(companyId);
    return {
      ok: true,
      message: `„${rows[0].name as string}" wurde archiviert.`,
    };
  } catch (e) {
    console.error("archiveCompany failed", e);
    return { ok: false, message: "Archivieren fehlgeschlagen." };
  }
}

/** Archiviertes Unternehmen wiederherstellen. */
export async function restoreCompany(companyId: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "delete");
    const rows = await sql`
      select name from public."Company" where id = ${companyId} limit 1`;
    if (!rows[0]) return { ok: false, message: "Unternehmen nicht gefunden." };
    await sql`
      update admin.company_meta
      set archived_at = null, updated_at = now()
      where company_id = ${companyId}`;
    await recordAudit({
      actorId: employee.id,
      action: "company.restored",
      entityType: "company",
      entityId: companyId,
      metadata: { name: rows[0].name as string },
    });
    revalidateCompany(companyId);
    return {
      ok: true,
      message: `„${rows[0].name as string}" wurde wiederhergestellt.`,
    };
  } catch (e) {
    console.error("restoreCompany failed", e);
    return { ok: false, message: "Wiederherstellen fehlgeschlagen." };
  }
}

/**
 * Endgültiges Löschen — nur SUPERADMIN, nur ohne Bewerbungen/Vermittlungen,
 * mit Namens-Bestätigung. Läuft in EINER Transaktion auf EINER Verbindung.
 *
 * Technik-Hinweis: sql.begin ist mit der db.ts-Option max_pipeline: 0
 * defekt (der onexecute-Callback, der die Verbindung reserviert, wird durch
 * den Pipeline-Check in postgres.js übersprungen → UNSAFE_TRANSACTION).
 * Deshalb sql.reserve() + manuelles begin/commit/rollback — gegen die
 * Live-DB mit ROLLBACK getestet, funktioniert mit dem Transaction-Pooler.
 */
export async function deleteCompanyPermanently(
  companyId: string,
  confirmName: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "delete");
    if (employee.roleId !== "SUPERADMIN") {
      return {
        ok: false,
        message: "Endgültiges Löschen ist nur für Superadmins erlaubt.",
      };
    }

    const companies = await sql`
      select name from public."Company" where id = ${companyId} limit 1`;
    const company = companies[0];
    if (!company) return { ok: false, message: "Unternehmen nicht gefunden." };
    const name = company.name as string;

    if (confirmName.trim().toLowerCase() !== name.trim().toLowerCase()) {
      return {
        ok: false,
        message: "Der eingegebene Firmenname stimmt nicht überein.",
      };
    }

    let deletedJobs = 0;
    let deletedContactRequests = 0;

    const tx = await sql.reserve();
    try {
      await tx.unsafe("begin");

      const jobs = await tx`
        select id from public."JobPosting" where "companyId" = ${companyId}`;
      const jobIds = jobs.map((j) => j.id as string);

      // Harte Sperren: Bewerbungen, Angebote, Favoriten an den Jobs sowie
      // Vermittlungen zum Unternehmen → abbrechen, nichts löschen.
      const [{ blocked }] = await tx`
        select (
          (select count(*) from public."JobApplication"
           where "jobPostingId" = any(${jobIds})) +
          (select count(*) from public."JobOffer"
           where "jobPostingId" = any(${jobIds})) +
          (select count(*) from public."Favorite"
           where "jobPostingId" = any(${jobIds})) +
          (select count(*) from admin.placement
           where company_id = ${companyId} and deleted_at is null)
        )::int as blocked`;
      if ((blocked as number) > 0) {
        await tx.unsafe("rollback");
        return {
          ok: false,
          message:
            "Endgültiges Löschen nicht möglich: verknüpfte Bewerbungen/Vermittlungen vorhanden. Bitte archivieren.",
        };
      }

      // Admin-Verknüpfungen aufräumen: nur company_meta, Tags und Favoriten.
      // Notizen/Aufgaben/Kommunikation bleiben bewusst stehen (zeigen dann
      // „gelöschtes Unternehmen").
      await tx`
        delete from admin.favorite
        where (entity_type = 'company' and entity_id = ${companyId})
           or (entity_type = 'job' and entity_id = any(${jobIds}))`;
      await tx`
        delete from admin.entity_tag
        where (entity_type = 'company' and entity_id = ${companyId})
           or (entity_type = 'job' and entity_id = any(${jobIds}))`;
      await tx`
        delete from admin.company_meta where company_id = ${companyId}`;

      const jobsResult = await tx`
        delete from public."JobPosting" where "companyId" = ${companyId}`;
      deletedJobs = jobsResult.count;
      const crResult = await tx`
        delete from public."ContactRequest" where "companyId" = ${companyId}`;
      deletedContactRequests = crResult.count;
      await tx`
        delete from public."Company" where id = ${companyId}`;

      await tx.unsafe("commit");
    } catch (txError) {
      await tx.unsafe("rollback").catch(() => {});
      throw txError;
    } finally {
      tx.release();
    }

    await recordAudit({
      actorId: employee.id,
      action: "company.deleted",
      entityType: "company",
      entityId: companyId,
      metadata: { name, deletedJobs, deletedContactRequests },
    });
    revalidateCompany(companyId);
    return {
      ok: true,
      message: `„${name}" wurde endgültig gelöscht (${deletedJobs} Jobs entfernt).`,
    };
  } catch (e) {
    console.error("deleteCompanyPermanently failed", e);
    return {
      ok: false,
      message: "Löschen fehlgeschlagen. Bitte erneut versuchen.",
    };
  }
}

// ── Status / Zuweisung ───────────────────────────────────────────────────

export async function updateCompanyStatus(
  companyId: string,
  status: string | null,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    if (!status || !STATUSES.includes(status)) {
      return { ok: false, message: "Unbekannter Status." };
    }
    await sql`
      insert into admin.company_meta (company_id, status, updated_at)
      values (${companyId}, ${status}, now())
      on conflict (company_id)
      do update set status = ${status}, updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "company.status_changed",
      entityType: "company",
      entityId: companyId,
      metadata: { status },
    });
    revalidateCompany(companyId);
    return {
      ok: true,
      message: `Status auf „${statusDef(COMPANY_STATUS, status).label}" gesetzt.`,
    };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

export async function assignCompany(
  companyId: string,
  assigneeId: string | null,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "assign");
    await sql`
      insert into admin.company_meta (company_id, assignee_id, updated_at)
      values (${companyId}, ${assigneeId}, now())
      on conflict (company_id)
      do update set assignee_id = ${assigneeId}, updated_at = now()`;
    await recordAudit({
      actorId: employee.id,
      action: "company.assigned",
      entityType: "company",
      entityId: companyId,
      metadata: { assigneeId },
    });
    if (assigneeId && assigneeId !== employee.id) {
      const [co] = await sql`
        select name from public."Company" where id = ${companyId} limit 1`;
      const name = (co?.name as string) || "ein Unternehmen";
      await sendeMitteilung({
        recipientIds: [assigneeId],
        kategorie: "EREIGNIS",
        type: "ASSIGNMENT",
        title: `Dir wurde ${name} zugewiesen`,
        body: `${employee.name} hat dir das Unternehmen ${name} zugeordnet.`,
        entityType: "company",
        entityId: companyId,
        senderId: employee.id,
      });
    }
    revalidateCompany(companyId);
    return { ok: true, message: "Zuständigkeit aktualisiert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Zuweisung fehlgeschlagen." };
  }
}

// ── Notizen / Aufgaben / Kommunikation ───────────────────────────────────

export async function addCompanyNote(
  companyId: string,
  content: string,
  category: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, message: "Die Notiz darf nicht leer sein." };
    await sql`
      insert into admin.note (content, category, author_id, entity_type, entity_id)
      values (${trimmed}, ${category || "ALLGEMEIN"}, ${employee.id}, 'company', ${companyId})`;
    await recordAudit({
      actorId: employee.id,
      action: "company.note_added",
      entityType: "company",
      entityId: companyId,
      metadata: { category },
    });
    revalidateCompany(companyId);
    return { ok: true, message: "Notiz gespeichert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gespeichert werden." };
  }
}

export async function addCompanyTask(
  companyId: string,
  payload: {
    title: string;
    description?: string;
    dueAt?: string | null;
    priority?: string;
    assigneeId?: string | null;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    const title = payload.title.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const priority = PRIORITIES.includes(payload.priority as Priority)
      ? payload.priority
      : "NORMAL";
    await sql`
      insert into admin.task (title, description, assignee_id, creator_id, due_at, priority, status, entity_type, entity_id)
      values (${title}, ${payload.description?.trim() || null},
              ${payload.assigneeId ?? employee.id}, ${employee.id},
              ${payload.dueAt || null}, ${priority!}, 'OPEN', 'company', ${companyId})`;
    await recordAudit({
      actorId: employee.id,
      action: "company.task_created",
      entityType: "company",
      entityId: companyId,
      metadata: { title },
    });
    revalidateCompany(companyId);
    return { ok: true, message: "Aufgabe angelegt." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}

export async function logCompanyCommunication(
  companyId: string,
  payload: {
    channel: string;
    direction: string;
    subject?: string;
    body?: string;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    if (!CHANNELS.includes(payload.channel)) {
      return { ok: false, message: "Unbekannter Kanal." };
    }
    if (!DIRECTIONS.includes(payload.direction)) {
      return { ok: false, message: "Unbekannte Richtung." };
    }
    await sql`
      insert into admin.communication (channel, direction, subject, body, entity_type, entity_id, employee_id, occurred_at)
      values (${payload.channel}, ${payload.direction},
              ${payload.subject?.trim() || null}, ${payload.body?.trim() || null},
              'company', ${companyId}, ${employee.id}, now())`;
    await recordAudit({
      actorId: employee.id,
      action: "company.communication_logged",
      entityType: "company",
      entityId: companyId,
      metadata: { channel: payload.channel, direction: payload.direction },
    });
    revalidateCompany(companyId);
    return { ok: true, message: "Kommunikation protokolliert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Eintrag konnte nicht gespeichert werden." };
  }
}

// ── Bulk-Aktionen ────────────────────────────────────────────────────────

export async function bulkAssignCompaniesToMe(
  ids: string[],
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "assign");
    if (ids.length === 0) return { ok: false, message: "Keine Auswahl." };
    await sql`
      insert into admin.company_meta (company_id, assignee_id, updated_at)
      select t.id, ${employee.id}::uuid, now() from unnest(${ids}::text[]) as t(id)
      on conflict (company_id)
      do update set assignee_id = ${employee.id}, updated_at = now()`;
    await Promise.all(
      ids.map((id) =>
        recordAudit({
          actorId: employee.id,
          action: "company.assigned",
          entityType: "company",
          entityId: id,
          metadata: { assigneeId: employee.id, bulk: true },
        }),
      ),
    );
    revalidateCompany();
    return { ok: true, message: `${ids.length} Unternehmen dir zugewiesen.` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bulk-Aktion fehlgeschlagen." };
  }
}

export async function bulkSetCompanyStatusAktiv(
  ids: string[],
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    if (ids.length === 0) return { ok: false, message: "Keine Auswahl." };
    await sql`
      insert into admin.company_meta (company_id, status, updated_at)
      select t.id, 'AKTIV', now() from unnest(${ids}::text[]) as t(id)
      on conflict (company_id)
      do update set status = 'AKTIV', updated_at = now()`;
    await Promise.all(
      ids.map((id) =>
        recordAudit({
          actorId: employee.id,
          action: "company.status_changed",
          entityType: "company",
          entityId: id,
          metadata: { status: "AKTIV", bulk: true },
        }),
      ),
    );
    revalidateCompany();
    return { ok: true, message: `${ids.length} Unternehmen auf „Aktiv" gesetzt.` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Bulk-Aktion fehlgeschlagen." };
  }
}
