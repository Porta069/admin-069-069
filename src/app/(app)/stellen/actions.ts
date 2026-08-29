"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PRIORITIES, type Priority } from "@/lib/definitions";
import { adminCreateJob, adminUpdateJob, BackendError } from "@/lib/backend";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/**
 * Stellen anlegen/bearbeiten läuft über den Admin-Schreibweg des Plattform-
 * Backends (POST/PATCH /employer/admin/jobs, x-admin-api-key) — dieselbe
 * geprüfte Tür wie der Betriebsweg. Damit gelten Katalogabgleich, das Tauschen
 * verdrehter Spannen, Stichwort-/Gewichts-Grenzen und die companyId-Prüfung
 * automatisch; die früher hier nachgebaute Validierung entfällt. KEIN direkter
 * SQL-Schreibzugriff mehr auf public."JobPosting" (Lesen bleibt erlaubt).
 */

export interface UpdateJobPayload {
  title: string;
  status: string;
  city: string;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  urlaubstage: number | null;
  montage: string;
  gewerk: string;
  gewerke: string[];
  berufe: string[];
  abschlussMin: string | null;
  meisterErwuenscht: boolean;
  bezeichnungTags: string[];
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  fuehrungGefordert: boolean;
  deutschMin: string | null;
  fuehrerscheinMin: string | null;
  montageMin: string | null;
  aufgaben: string[];
  aufgabenMin: number | null;
  gebotenes: string[];
  startBis: string | null;
  budgetMonatCents?: number | null;
  gewichte: Record<string, number>;
}

/** Backend-Fehler → für den Mitarbeiter lesbare Meldung (Feldname inklusive). */
function backendFehler(e: unknown, fallback: string): ActionResult {
  if (e instanceof BackendError) {
    if (e.status === 401 || e.status === 403) {
      return { ok: false, message: "Backend-Zugriff nicht autorisiert — ADMIN_API_KEY prüfen." };
    }
    return { ok: false, message: e.message };
  }
  console.error(fallback, e);
  return { ok: false, message: `${fallback} — Backend nicht erreichbar? Bitte erneut versuchen.` };
}

export async function updateJob(
  jobId: string,
  payload: UpdateJobPayload,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");

    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const gewerk = payload.gewerk?.trim();
    if (!gewerk) return { ok: false, message: "Bitte ein Gewerk der Stelle wählen." };

    // companyId der Stelle lesen (Lesen erlaubt) — das Backend prüft zusätzlich,
    // dass das Inserat wirklich zu diesem Betrieb gehört.
    const [job] = await sql`
      select "companyId" from public."JobPosting" where id = ${jobId} limit 1`;
    if (!job) return { ok: false, message: "Die Stellenanzeige wurde nicht gefunden." };

    // Gewerk der Stelle immer in den akzeptierten Gewerken enthalten.
    const gewerke =
      gewerk && !payload.gewerke.includes(gewerk) ? [gewerk, ...payload.gewerke] : payload.gewerke;
    // budgetMonatCents (Matching, Cent) konsistent aus salaryMax (EUR); NULL = keine Obergrenze.
    const budgetMonatCents = payload.salaryMax != null ? payload.salaryMax * 100 : null;

    // Nur SaveJobDto-Felder senden (Backend läuft mit forbidNonWhitelisted).
    const jobDto = {
      title,
      status: payload.status,
      city: payload.city?.trim() ?? "",
      description: payload.description?.trim() ?? "",
      salaryMin: payload.salaryMin,
      salaryMax: payload.salaryMax,
      urlaubstage: payload.urlaubstage,
      montage: payload.montage?.trim() ?? "",
      gewerk,
      gewerke,
      berufe: payload.berufe,
      abschlussMin: payload.abschlussMin,
      meisterErwuenscht: payload.meisterErwuenscht === true,
      bezeichnungTags: payload.bezeichnungTags,
      erfahrungMin: payload.erfahrungMin,
      erfahrungMax: payload.erfahrungMax,
      fuehrungGefordert: payload.fuehrungGefordert === true,
      deutschMin: payload.deutschMin,
      fuehrerscheinMin: payload.fuehrerscheinMin,
      montageMin: payload.montageMin,
      aufgaben: payload.aufgaben,
      aufgabenMin: payload.aufgabenMin ?? 0,
      gebotenes: payload.gebotenes,
      startBis: payload.startBis,
      budgetMonatCents,
      gewichte: payload.gewichte,
    };

    await adminUpdateJob(jobId, job.companyId as string, "ADMIN", jobDto);

    await recordAudit({
      actorId: employee.id,
      action: "job.updated",
      entityType: "job",
      entityId: jobId,
      metadata: { via: "backend" },
    });
    revalidatePath("/stellen");
    revalidatePath(`/stellen/${jobId}`);
    revalidatePath("/matching");
    revalidateTag("jobs", "max");
    return { ok: true, message: "Stellenanzeige aktualisiert." };
  } catch (e) {
    return backendFehler(e, "Speichern fehlgeschlagen");
  }
}

export async function addJobNote(
  jobId: string,
  content: string,
  category: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");
    const trimmed = content.trim();
    if (!trimmed) return { ok: false, message: "Die Notiz darf nicht leer sein." };
    await sql`
      insert into admin.note (content, category, author_id, entity_type, entity_id)
      values (${trimmed}, ${category || "ALLGEMEIN"}, ${employee.id}, 'job', ${jobId})`;
    await recordAudit({
      actorId: employee.id,
      action: "job.note_added",
      entityType: "job",
      entityId: jobId,
      metadata: { category },
    });
    revalidatePath(`/stellen/${jobId}`);
    return { ok: true, message: "Notiz gespeichert." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Notiz konnte nicht gespeichert werden." };
  }
}

export async function addJobTask(
  jobId: string,
  payload: {
    title: string;
    description?: string;
    dueAt?: string | null;
    priority?: string;
    assigneeId?: string | null;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");
    const title = payload.title.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const priority = PRIORITIES.includes(payload.priority as Priority)
      ? payload.priority
      : "NORMAL";
    await sql`
      insert into admin.task (title, description, assignee_id, creator_id, due_at, priority, status, entity_type, entity_id)
      values (${title}, ${payload.description?.trim() || null},
              ${payload.assigneeId ?? employee.id}, ${employee.id},
              ${payload.dueAt || null}, ${priority!}, 'OPEN', 'job', ${jobId})`;
    await recordAudit({
      actorId: employee.id,
      action: "job.task_created",
      entityType: "job",
      entityId: jobId,
      metadata: { title },
    });
    revalidatePath(`/stellen/${jobId}`);
    return { ok: true, message: "Aufgabe angelegt." };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Aufgabe konnte nicht angelegt werden." };
  }
}

// ── Job anlegen ──────────────────────────────────────────────────────────

export interface CreateJobPayload {
  companyId: string;
  title: string;
  city: string;
  /** Gewerke der Stelle — erstes ist das Pflicht-Gewerk, alle sind akzeptiert. */
  gewerke: string[];
  status: "DRAFT" | "ACTIVE";
}

export async function createJob(
  payload: CreateJobPayload,
): Promise<ActionResult & { jobId?: string }> {
  try {
    const employee = await requirePermission("jobs", "create");
    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const gewerke = payload.gewerke.filter(Boolean);
    if (gewerke.length === 0) {
      return { ok: false, message: "Bitte mindestens ein Gewerk wählen." };
    }
    if (!payload.companyId) return { ok: false, message: "Bitte ein Unternehmen wählen." };

    // Minimal-Entwurf — Anforderungen/Gewichte pflegt der Editor danach.
    const jobDto = {
      title,
      gewerk: gewerke[0],
      gewerke,
      city: payload.city?.trim() || undefined,
      status: payload.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    };

    const created = await adminCreateJob(payload.companyId, "ADMIN", jobDto);
    const jobId = created.id;

    await recordAudit({
      actorId: employee.id,
      action: "job.created",
      entityType: "job",
      entityId: jobId,
      metadata: { via: "backend", title, companyId: payload.companyId, gewerke },
    });
    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${payload.companyId}`);
    revalidateTag("jobs", "max");
    return { ok: true, message: "Stelle angelegt — jetzt Kriterien pflegen.", jobId };
  } catch (e) {
    return backendFehler(e, "Anlegen fehlgeschlagen");
  }
}
