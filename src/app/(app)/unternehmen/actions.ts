"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
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
