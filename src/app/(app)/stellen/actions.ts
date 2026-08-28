"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { JOB_STATUS, PRIORITIES, type Priority } from "@/lib/definitions";
import { getKatalog } from "@/lib/matching/catalog-live";
import { WEIGHT_CRITERIA, WEIGHT_MAX } from "./_lib/job-criteria";

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

/**
 * Prüf-Kontext aus dem LIVE-Katalog (GET /catalog). Weil das Dashboard direkt in
 * die DB schreibt, umgeht es die Backend-Validierung — deshalb hier dieselben
 * Prüfungen gegen dieselbe Quelle, nicht gegen eine abgeschriebene Liste.
 */
async function katalogPruefer() {
  const { katalog: k } = await getKatalog();
  const gewerkVals = new Set(k.gewerke.map((g) => g.value));
  const berufeFuer = (gewerke: string[]) =>
    new Set(
      k.gewerke
        .filter((g) => gewerke.includes(g.value))
        .flatMap((g) => g.berufe.map((b) => b.value)),
    );
  const aufgabenFuer = (gewerke: string[]) =>
    new Set(
      k.gewerke
        .filter((g) => gewerke.includes(g.value))
        .flatMap((g) => g.aufgaben.map((a) => a.value)),
    );
  const setOf = (skala: { value: string }[]) => new Set(skala.map((o) => o.value));
  const erfahrungRang = (v: string | null) =>
    v ? (k.erfahrung.find((o) => o.value === v)?.rang ?? null) : null;
  return {
    gewerkVals,
    berufeFuer,
    aufgabenFuer,
    abschluss: setOf(k.abschluss),
    montage: setOf(k.montage),
    deutsch: setOf(k.deutsch),
    fuehrerschein: setOf(k.fuehrerschein),
    start: setOf(k.start),
    wuensche: setOf(k.wuensche),
    erfahrung: setOf(k.erfahrung),
    erfahrungRang,
  };
}

function cleanArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values.map((v) => String(v).trim()).filter((v) => v.length > 0 && v.length <= 120),
    ),
  ].slice(0, 40);
}

/** Stichworte zur Berufsbezeichnung: klein, entdoppelt, je 2–60 Zeichen, max 10. */
function cleanBezeichnungTags(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((v) => String(v).trim().toLowerCase().replace(/\s+/g, " "))
        .filter((v) => v.length >= 2 && v.length <= 60),
    ),
  ].slice(0, 10);
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
    const kat = await katalogPruefer();

    // ── Validierung ───────────────────────────────────────────────────
    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const city = payload.city?.trim();
    if (!city) return { ok: false, message: "Bitte einen Ort angeben." };
    if (!Object.keys(JOB_STATUS).includes(payload.status)) {
      return { ok: false, message: "Unbekannter Status." };
    }
    const montage = payload.montage?.trim();
    if (!montage) return { ok: false, message: "Bitte eine Montage-Angabe wählen." };
    const description = payload.description?.trim() ?? "";

    // Gewerk der Stelle (Pflicht) + akzeptierte Gewerke (Ausschluss, kann leer).
    const gewerke = cleanArray(payload.gewerke).filter((g) => kat.gewerkVals.has(g));
    const gewerk = (payload.gewerk?.trim() || gewerke[0] || "").trim();
    if (!gewerk || !kat.gewerkVals.has(gewerk)) {
      return { ok: false, message: "Bitte ein gültiges Gewerk der Stelle wählen." };
    }
    // Der Filter-Umfang muss das Gewerk der Stelle einschließen.
    const gewerkeFinal = gewerke.length > 0 ? gewerke : [gewerk];

    let salaryMin: number | null;
    let salaryMax: number | null;
    let urlaubstage: number | null;
    try {
      salaryMin = cleanInt(payload.salaryMin, "Gehalt (min.)");
      salaryMax = cleanInt(payload.salaryMax, "Gehalt (max.)");
      urlaubstage = cleanInt(payload.urlaubstage, "Urlaubstage");
    } catch (e) {
      const field = e instanceof Error ? e.message.replace("INVALID:", "") : "";
      return { ok: false, message: `Bitte für „${field}" eine ganze Zahl ≥ 0 angeben.` };
    }
    if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
      return { ok: false, message: "Das Mindestgehalt darf nicht über dem Maximalgehalt liegen." };
    }
    // budgetMonatCents (Matching, CENT/Monat) konsistent aus salaryMax (EUR/Monat).
    // NULL = keine Obergrenze → schließt niemanden aus. NIE 0 als Platzhalter.
    const budgetMonatCents = salaryMax != null ? salaryMax * 100 : null;

    // Berufe/Aufgaben nur aus den gewählten Gewerken.
    const erlaubteBerufe = kat.berufeFuer(gewerkeFinal);
    const berufe = cleanArray(payload.berufe).filter((b) => erlaubteBerufe.has(b));
    const erlaubteAufgaben = kat.aufgabenFuer(gewerkeFinal);
    const aufgaben = cleanArray(payload.aufgaben).filter((a) => erlaubteAufgaben.has(a));

    let aufgabenMin: number;
    try {
      aufgabenMin = cleanInt(payload.aufgabenMin, "Aufgaben-Mindestabdeckung") ?? 0;
    } catch {
      return { ok: false, message: "Aufgaben-Mindestabdeckung muss eine ganze Zahl ≥ 0 sein." };
    }
    if (aufgabenMin > aufgaben.length) {
      return {
        ok: false,
        message:
          "Die Aufgaben-Mindestabdeckung darf nicht größer sein als die Zahl der gewählten Aufgabenbereiche.",
      };
    }

    const gebotenes = cleanArray(payload.gebotenes).filter((g) => kat.wuensche.has(g));
    const bezeichnungTags = cleanBezeichnungTags(payload.bezeichnungTags);

    // Niveau-Felder gegen den Live-Katalog prüfen.
    const level = (
      value: string | null,
      erlaubt: Set<string>,
      feld: string,
    ): { ok: true; wert: string | null } | { ok: false; message: string } => {
      if (value == null || value === "") return { ok: true, wert: null };
      if (!erlaubt.has(value)) return { ok: false, message: `Ungültiger Wert für „${feld}".` };
      return { ok: true, wert: value };
    };
    const abschlussMinR = level(payload.abschlussMin, kat.abschluss, "Mindestabschluss");
    if (!abschlussMinR.ok) return abschlussMinR;
    const deutschMinR = level(payload.deutschMin, kat.deutsch, "Deutschkenntnisse");
    if (!deutschMinR.ok) return deutschMinR;
    const fsMinR = level(payload.fuehrerscheinMin, kat.fuehrerschein, "Führerschein");
    if (!fsMinR.ok) return fsMinR;
    const montageMinR = level(payload.montageMin, kat.montage, "Montagebereitschaft");
    if (!montageMinR.ok) return montageMinR;
    const startBisR = level(payload.startBis, kat.start, "Besetzen bis");
    if (!startBisR.ok) return startBisR;

    // Erfahrungsspanne: gültige Werte, verdrehte Spanne wird getauscht.
    const eMinR = level(payload.erfahrungMin, kat.erfahrung, "Erfahrung (min.)");
    if (!eMinR.ok) return eMinR;
    const eMaxR = level(payload.erfahrungMax, kat.erfahrung, "Erfahrung (max.)");
    if (!eMaxR.ok) return eMaxR;
    let erfahrungMin = eMinR.wert;
    let erfahrungMax = eMaxR.wert;
    const rMin = kat.erfahrungRang(erfahrungMin);
    const rMax = kat.erfahrungRang(erfahrungMax);
    if (rMin != null && rMax != null && rMin > rMax) {
      [erfahrungMin, erfahrungMax] = [erfahrungMax, erfahrungMin];
    }

    // Gewichte: exakt die neun Engine-Kriterien, 0–5. Alt-Keys verwerfen.
    const allowedWeightKeys = new Set(WEIGHT_CRITERIA.map((c) => c.value));
    const gewichte: Record<string, number> = {};
    for (const [key, raw] of Object.entries(payload.gewichte ?? {})) {
      if (!allowedWeightKeys.has(key)) continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0 || num > WEIGHT_MAX) {
        return { ok: false, message: `Gewicht für „${key}" muss zwischen 0 und ${WEIGHT_MAX} liegen.` };
      }
      gewichte[key] = Math.round(num);
    }

    // Vorher-Werte für den Diff lesen (und Existenz prüfen).
    const beforeRows = await sql`
      select title, status::text as status, city, description,
             "salaryMin", "salaryMax", urlaubstage, montage, gewerk, gewerke,
             berufe, "abschlussMin", "meisterErwuenscht", "bezeichnungTags",
             "erfahrungMin", "erfahrungMax", "fuehrungGefordert", "deutschMin",
             "fuehrerscheinMin", "montageMin", aufgaben, "aufgabenMin",
             gebotenes, "startBis", "budgetMonatCents", gewichte
      from public."JobPosting" where id = ${jobId} limit 1`;
    const before = beforeRows[0];
    if (!before) return { ok: false, message: "Die Stellenanzeige wurde nicht gefunden." };

    const after: Record<string, unknown> = {
      title, status: payload.status, city, description, salaryMin, salaryMax,
      urlaubstage, montage, gewerk, gewerke: gewerkeFinal, berufe,
      abschlussMin: abschlussMinR.wert, meisterErwuenscht: payload.meisterErwuenscht === true,
      bezeichnungTags, erfahrungMin, erfahrungMax,
      fuehrungGefordert: payload.fuehrungGefordert === true, deutschMin: deutschMinR.wert,
      fuehrerscheinMin: fsMinR.wert, montageMin: montageMinR.wert, aufgaben, aufgabenMin,
      gebotenes, startBis: startBisR.wert, budgetMonatCents, gewichte,
    };
    const diff: Record<string, { von: unknown; zu: unknown }> = {};
    for (const [key, next] of Object.entries(after)) {
      const prev = before[key] ?? null;
      if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) {
        diff[key] = { von: prev ?? null, zu: next ?? null };
      }
    }
    if (Object.keys(diff).length === 0) {
      return { ok: true, message: "Keine Änderungen — nichts gespeichert." };
    }

    // Ausnahme laut Auftrag: JobPosting direkt per SQL (nur freigegebene Spalten).
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
        gewerke = ${gewerkeFinal}::text[],
        berufe = ${berufe}::text[],
        "abschlussMin" = ${abschlussMinR.wert},
        "meisterErwuenscht" = ${payload.meisterErwuenscht === true},
        "bezeichnungTags" = ${bezeichnungTags}::text[],
        "erfahrungMin" = ${erfahrungMin},
        "erfahrungMax" = ${erfahrungMax},
        "fuehrungGefordert" = ${payload.fuehrungGefordert === true},
        "deutschMin" = ${deutschMinR.wert},
        "fuehrerscheinMin" = ${fsMinR.wert},
        "montageMin" = ${montageMinR.wert},
        aufgaben = ${aufgaben}::text[],
        "aufgabenMin" = ${aufgabenMin},
        gebotenes = ${gebotenes}::text[],
        "startBis" = ${startBisR.wert},
        "budgetMonatCents" = ${budgetMonatCents},
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
    revalidateTag("jobs", "max");
    return { ok: true, message: "Stellenanzeige aktualisiert." };
  } catch (e) {
    console.error("updateJob failed", e);
    return { ok: false, message: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
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
    const kat = await katalogPruefer();

    const title = payload.title?.trim();
    if (!title) return { ok: false, message: "Bitte einen Titel angeben." };
    const city = payload.city?.trim() ?? "";
    const gewerke = cleanArray(payload.gewerke).filter((g) => kat.gewerkVals.has(g));
    if (gewerke.length === 0) {
      return { ok: false, message: "Bitte mindestens ein Gewerk wählen." };
    }
    // gewerk = Pflicht-Gewerk der Stelle (Anzeige/Suche/Index), gewerke = akzeptiert.
    const gewerk = gewerke[0];
    const status = payload.status === "ACTIVE" ? "ACTIVE" : "DRAFT";

    const companies = await sql`
      select id, name, lat, lng, ort from public."Company"
      where id = ${payload.companyId} limit 1`;
    if (!companies[0]) return { ok: false, message: "Unternehmen nicht gefunden." };

    const rows = await sql`
      insert into public."JobPosting"
        (id, "companyId", title, gewerk, gewerke, city, lat, lng,
         status, source, "createdAt", "updatedAt")
      values
        (gen_random_uuid()::text, ${payload.companyId}, ${title}, ${gewerk},
         ${gewerke}::text[],
         ${city || (companies[0].ort as string) || ""},
         ${companies[0].lat as number | null}, ${companies[0].lng as number | null},
         ${status}::"JobStatus", 'ADMIN', now(), now())
      returning id`;
    const jobId = rows[0].id as string;

    await recordAudit({
      actorId: employee.id,
      action: "job.created",
      entityType: "job",
      entityId: jobId,
      metadata: { title, companyId: payload.companyId, gewerk, gewerke, status },
    });
    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${payload.companyId}`);
    revalidateTag("jobs", "max");
    return { ok: true, message: "Stelle angelegt — jetzt Kriterien pflegen.", jobId };
  } catch (e) {
    console.error("createJob failed", e);
    return { ok: false, message: "Anlegen fehlgeschlagen. Bitte erneut versuchen." };
  }
}
