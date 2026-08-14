"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { JOB_STATUS, PRIORITIES, type Priority } from "@/lib/definitions";
import {
  AUSBILDUNG_OPTIONS,
  BEREICH_OPTIONS,
  DEUTSCH_OPTIONS,
  ERFAHRUNG_OPTIONS,
  FUEHRERSCHEIN_OPTIONS,
  MONTAGE_MIN_OPTIONS,
  PRIORITAETEN_OPTIONS,
  START_OPTIONS,
  WEIGHT_CRITERIA,
  WEIGHT_MAX,
  aufgabenOptionsFuer,
  bereichLabel,
} from "./_lib/job-criteria";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

// ── Job-Kriterien bearbeiten ─────────────────────────────────────────────

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
  berufe: string[];
  bereiche: string[];
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  ausbildungMin: string | null;
  deutschMin: string | null;
  fuehrerscheinMin: string | null;
  montageMin: string | null;
  aufgaben: string[];
  aufgabenMin: number | null;
  gebotenes: string[];
  startBis: string | null;
  gewichte: Record<string, number>;
}

/** Editierbare Spalten — nur diese werden je geschrieben. */
const LEVEL_FIELDS = [
  ["erfahrungMin", ERFAHRUNG_OPTIONS],
  ["erfahrungMax", ERFAHRUNG_OPTIONS],
  ["ausbildungMin", AUSBILDUNG_OPTIONS],
  ["deutschMin", DEUTSCH_OPTIONS],
  ["fuehrerscheinMin", FUEHRERSCHEIN_OPTIONS],
  ["montageMin", MONTAGE_MIN_OPTIONS],
] as const;

function cleanArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0 && v.length <= 120),
    ),
  ].slice(0, 40);
}

function cleanInt(value: unknown, field: string): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    throw new Error(`INVALID:${field}`);
  }
  return num;
}

export async function updateJob(
  jobId: string,
  payload: UpdateJobPayload,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("jobs", "edit");

    // ── Validierung ───────────────────────────────────────────────────
    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const city = payload.city?.trim();
    if (!city) return { ok: false, message: "Bitte einen Ort angeben." };
    if (!Object.keys(JOB_STATUS).includes(payload.status)) {
      return { ok: false, message: "Unbekannter Status." };
    }
    const gewerk = payload.gewerk?.trim();
    if (!gewerk) return { ok: false, message: "Bitte ein Gewerk angeben." };
    const montage = payload.montage?.trim();
    if (!montage) {
      return { ok: false, message: "Bitte eine Montage-Angabe wählen." };
    }
    const description = payload.description?.trim() ?? "";

    let salaryMin: number | null;
    let salaryMax: number | null;
    let urlaubstage: number | null;
    try {
      salaryMin = cleanInt(payload.salaryMin, "Gehalt (min.)");
      salaryMax = cleanInt(payload.salaryMax, "Gehalt (max.)");
      urlaubstage = cleanInt(payload.urlaubstage, "Urlaubstage");
    } catch (e) {
      const field = e instanceof Error ? e.message.replace("INVALID:", "") : "";
      return {
        ok: false,
        message: `Bitte für „${field}" eine ganze Zahl ≥ 0 angeben.`,
      };
    }
    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return {
        ok: false,
        message: "Das Mindestgehalt darf nicht über dem Maximalgehalt liegen.",
      };
    }

    const berufe = cleanArray(payload.berufe);
    const bereiche = cleanArray(payload.bereiche);

    // Aufgabenbereiche: nur Katalogwerte der gewählten Bereiche.
    const erlaubteAufgaben = new Set(
      aufgabenOptionsFuer(
        bereiche.length > 0 ? bereiche : BEREICH_OPTIONS.map((b) => b.value),
      ).map((o) => o.value),
    );
    const aufgaben = cleanArray(payload.aufgaben).filter((a) =>
      erlaubteAufgaben.has(a),
    );

    // aufgabenMin: >0 schließt Bewerber hart aus — deshalb hart validieren.
    let aufgabenMin: number;
    try {
      aufgabenMin = cleanInt(payload.aufgabenMin, "Aufgaben-Mindestabdeckung") ?? 0;
    } catch {
      return {
        ok: false,
        message: "Aufgaben-Mindestabdeckung muss eine ganze Zahl ≥ 0 sein.",
      };
    }
    if (aufgabenMin > aufgaben.length) {
      return {
        ok: false,
        message:
          "Die Aufgaben-Mindestabdeckung darf nicht größer sein als die Zahl der gewählten Aufgabenbereiche.",
      };
    }

    // Gebotenes: nur die elf Katalog-Prioritäten.
    const erlaubtePrios = new Set(PRIORITAETEN_OPTIONS.map((o) => o.value));
    const gebotenes = cleanArray(payload.gebotenes).filter((g) =>
      erlaubtePrios.has(g),
    );

    // startBis: Wert der START-Skala oder leer.
    let startBis: string | null = null;
    if (payload.startBis) {
      if (!START_OPTIONS.some((o) => o.value === payload.startBis)) {
        return { ok: false, message: "Ungültiger Wert für „Besetzen bis“." };
      }
      startBis = payload.startBis;
    }

    const levels: Record<string, string | null> = {};
    for (const [field, options] of LEVEL_FIELDS) {
      const raw = payload[field];
      if (raw == null || raw === "") {
        levels[field] = null;
      } else if (options.some((o) => o.value === raw)) {
        levels[field] = raw;
      } else {
        return {
          ok: false,
          message: `Ungültiger Wert für „${field}".`,
        };
      }
    }

    // Vorher-Werte für den Diff lesen (und Existenz prüfen).
    const beforeRows = await sql`
      select title, status::text as status, city, description,
             "salaryMin", "salaryMax", urlaubstage, montage, gewerk,
             berufe, bereiche, "erfahrungMin", "erfahrungMax",
             "ausbildungMin", "deutschMin", "fuehrerscheinMin", "montageMin",
             aufgaben, "aufgabenMin", gebotenes, "startBis",
             gewichte
      from public."JobPosting"
      where id = ${jobId}
      limit 1`;
    const before = beforeRows[0];
    if (!before) {
      return { ok: false, message: "Die Stellenanzeige wurde nicht gefunden." };
    }

    // Gewichte: exakt die sechs Engine-Kriterien, Skala 0–5 (wie die Engine
    // selbst begrenzt). Alt-Keys (deutsch, montage, entfernung, …) sind
    // Ausschlusskriterien und werden beim Speichern verworfen.
    const allowedWeightKeys = new Set(WEIGHT_CRITERIA.map((c) => c.value));
    const gewichte: Record<string, number> = {};
    for (const [key, raw] of Object.entries(payload.gewichte ?? {})) {
      if (!allowedWeightKeys.has(key)) continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0 || num > WEIGHT_MAX) {
        return {
          ok: false,
          message: `Gewicht für „${key}" muss zwischen 0 und ${WEIGHT_MAX} liegen.`,
        };
      }
      gewichte[key] = Math.round(num);
    }

    // ── Diff für den Audit-Trail ──────────────────────────────────────
    const after: Record<string, unknown> = {
      title,
      status: payload.status,
      city,
      description,
      salaryMin,
      salaryMax,
      urlaubstage,
      montage,
      gewerk,
      berufe,
      bereiche,
      aufgaben,
      aufgabenMin,
      gebotenes,
      startBis,
      ...levels,
      gewichte,
    };
    const diff: Record<string, { von: unknown; zu: unknown }> = {};
    for (const [key, next] of Object.entries(after)) {
      const prev = before[key] ?? null;
      const a = JSON.stringify(prev ?? null);
      const b = JSON.stringify(next ?? null);
      if (a !== b) diff[key] = { von: prev ?? null, zu: next ?? null };
    }
    if (Object.keys(diff).length === 0) {
      return { ok: true, message: "Keine Änderungen — nichts gespeichert." };
    }

    // Ausnahme laut Auftrag: JobPosting-Kriterien direkt per SQL schreiben
    // (nur die freigegebenen Spalten, updatedAt mitziehen).
    await sql`
      update public."JobPosting" set
        title = ${title},
        status = ${payload.status}::"JobStatus",
        city = ${city},
        description = ${description},
        "salaryMin" = ${salaryMin},
        "salaryMax" = ${salaryMax},
        urlaubstage = ${urlaubstage},
        montage = ${montage},
        gewerk = ${gewerk},
        berufe = ${berufe}::text[],
        bereiche = ${bereiche}::text[],
        "erfahrungMin" = ${levels.erfahrungMin},
        "erfahrungMax" = ${levels.erfahrungMax},
        "ausbildungMin" = ${levels.ausbildungMin},
        "deutschMin" = ${levels.deutschMin},
        "fuehrerscheinMin" = ${levels.fuehrerscheinMin},
        "montageMin" = ${levels.montageMin},
        aufgaben = ${aufgaben}::text[],
        "aufgabenMin" = ${aufgabenMin},
        gebotenes = ${gebotenes}::text[],
        "startBis" = ${startBis},
        gewichte = ${sql.json(gewichte)},
        "updatedAt" = now()
      where id = ${jobId}`;

    await recordAudit({
      actorId: employee.id,
      action: "job.updated",
      entityType: "job",
      entityId: jobId,
      metadata: { diff },
    });
    revalidatePath("/stellen");
    revalidatePath(`/stellen/${jobId}`);
    revalidatePath("/matching");
    return { ok: true, message: "Stellenanzeige aktualisiert." };
  } catch (e) {
    console.error("updateJob failed", e);
    return {
      ok: false,
      message: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
    };
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
  bereiche: string[];
  status: "DRAFT" | "ACTIVE";
}

export async function createJob(
  payload: CreateJobPayload,
): Promise<ActionResult & { jobId?: string }> {
  try {
    const employee = await requirePermission("jobs", "create");
    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const city = payload.city?.trim() ?? "";
    const bereiche = cleanArray(payload.bereiche).filter((b) =>
      BEREICH_OPTIONS.some((o) => o.value === b),
    );
    if (bereiche.length === 0) {
      return { ok: false, message: "Bitte mindestens einen Bereich wählen." };
    }
    const status = payload.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

    const companies = await sql`
      select id, name, lat, lng, ort from public."Company"
      where id = ${payload.companyId} limit 1`;
    if (!companies[0]) {
      return { ok: false, message: "Unternehmen nicht gefunden." };
    }

    // gewerk ist reiner Anzeigetext (fürs Matching irrelevant) — Label des
    // ersten Bereichs. Koordinaten vom Unternehmen übernehmen, damit der
    // Arbeitsradius-Ausschluss greifen kann.
    const gewerk = bereichLabel(bereiche[0]);
    const rows = await sql`
      insert into public."JobPosting"
        (id, "companyId", title, gewerk, city, lat, lng, bereiche,
         status, source, "createdAt", "updatedAt")
      values
        (gen_random_uuid()::text, ${payload.companyId}, ${title}, ${gewerk},
         ${city || (companies[0].ort as string) || ""},
         ${companies[0].lat as number | null}, ${companies[0].lng as number | null},
         ${bereiche}::text[], ${status}::"JobStatus", 'ADMIN', now(), now())
      returning id`;
    const jobId = rows[0].id as string;

    await recordAudit({
      actorId: employee.id,
      action: "job.created",
      entityType: "job",
      entityId: jobId,
      metadata: { title, companyId: payload.companyId, bereiche, status },
    });
    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${payload.companyId}`);
    return { ok: true, message: "Stelle angelegt — jetzt Kriterien pflegen.", jobId };
  } catch (e) {
    console.error("createJob failed", e);
    return { ok: false, message: "Anlegen fehlgeschlagen. Bitte erneut versuchen." };
  }
}
