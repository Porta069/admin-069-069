"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import * as backend from "@/lib/backend";
import {
  extrahiereIntake,
  type KiExtraktion,
  type KiJob,
} from "@/lib/ki-intake";

export type ExtraktionErgebnis =
  | { ok: true; extraktion: KiExtraktion; bestehendesUnternehmen: { id: string; name: string } | null }
  | { ok: false; fehler: string };

/** Runde 1 (nur Text) oder Runde 2 (Text + Antworten auf Rückfragen). */
export async function kiExtrahieren(
  text: string,
  runde2?: {
    vorherige: KiExtraktion;
    antworten: { frage: string; antwort: string }[];
  },
): Promise<ExtraktionErgebnis> {
  try {
    const employee = await requirePermission("companies", "create");
    const ergebnis = await extrahiereIntake(text, runde2);
    if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };

    await recordAudit({
      actorId: employee.id,
      action: "ki.intake_extrahiert",
      entityType: "company",
      metadata: {
        runde: runde2 ? 2 : 1,
        textLaenge: text.length,
        jobs: ergebnis.extraktion.jobs.length,
        rueckfragen: ergebnis.extraktion.rueckfragen.length,
      },
    });

    // Duplikat-Check: existiert das Unternehmen schon?
    let bestehendesUnternehmen: { id: string; name: string } | null = null;
    const name = ergebnis.extraktion.unternehmen.firmenname?.trim();
    if (name) {
      const [row] = await sql`
        select id, name from public."Company"
        where lower(name) = lower(${name}) limit 1`;
      if (row) bestehendesUnternehmen = { id: row.id as string, name: row.name as string };
    }

    return { ok: true, extraktion: ergebnis.extraktion, bestehendesUnternehmen };
  } catch (e) {
    console.error("kiExtrahieren failed", e);
    return { ok: false, fehler: "Extraktion fehlgeschlagen — bitte erneut versuchen." };
  }
}

// ── Anlegen ────────────────────────────────────────────────────────────────

/** gewerk ist Pflicht (NOT NULL): gewählter Slug, sonst erstes akzeptierte Gewerk. */
function gewerkFuer(j: KiJob): string {
  return (j.gewerk?.trim() || j.gewerke[0] || "").slice(0, 60);
}

function jobZuDto(j: KiJob) {
  return {
    title: j.title.slice(0, 120),
    gewerk: gewerkFuer(j),
    description: j.description ?? undefined,
    city: j.city ?? undefined,
    salaryMin: j.salaryMin ?? undefined,
    salaryMax: j.salaryMax ?? undefined,
    budgetMonatCents: j.budgetMonatCents ?? undefined,
    montage: j.montage ?? undefined,
    urlaubstage: j.urlaubstage ?? undefined,
    startText: j.startText ?? undefined,
    status: "DRAFT" as const,
    gewerke: j.gewerke.length ? j.gewerke : undefined,
    berufe: j.berufe.length ? j.berufe : undefined,
    aufgaben: j.aufgaben.length ? j.aufgaben : undefined,
    aufgabenMin: j.aufgabenMin || undefined,
    erfahrungMin: j.erfahrungMin ?? undefined,
    erfahrungMax: j.erfahrungMax ?? undefined,
    abschlussMin: j.abschlussMin ?? undefined,
    meisterErwuenscht: j.meisterErwuenscht,
    fuehrungGefordert: j.fuehrungGefordert,
    bezeichnungTags: j.bezeichnungTags.length ? j.bezeichnungTags : undefined,
    montageMin: j.montageMin ?? undefined,
    fuehrerscheinMin: j.fuehrerscheinMin ?? undefined,
    deutschMin: j.deutschMin ?? undefined,
    gebotenes: j.gebotenes.length ? j.gebotenes : undefined,
    startBis: j.startBis ?? undefined,
  };
}

export type AnlegenErgebnis =
  | { ok: true; companyId: string | null; jobsAngelegt: number }
  | { ok: false; fehler: string };

/**
 * Neues Unternehmen + Jobs in EINEM Backend-Aufruf (AdminCreateCompanyDto,
 * source AI) — die Plattform-Validierung des Backends greift vollständig.
 */
export async function kiUnternehmenAnlegen(
  extraktion: KiExtraktion,
): Promise<AnlegenErgebnis> {
  try {
    const employee = await requirePermission("companies", "create");
    const u = extraktion.unternehmen;
    const firmenname = u.firmenname?.trim();
    if (!firmenname) {
      return { ok: false, fehler: "Ohne Firmennamen kann nichts angelegt werden." };
    }
    const ohneGewerk = extraktion.jobs.find((j) => !gewerkFuer(j));
    if (ohneGewerk) {
      return {
        ok: false,
        fehler: `Der Stelle „${ohneGewerk.title}" ist kein gültiges Gewerk zugeordnet — bitte im Katalog nachtragen.`,
      };
    }

    const payload = {
      source: "AI" as const,
      managedNote: `Per KI-Intake angelegt von ${employee.name} (${new Date().toISOString().slice(0, 10)})`,
      profile: {
        firmenname: firmenname.slice(0, 120),
        slogan: u.slogan ?? undefined,
        beschreibung: u.beschreibung ?? undefined,
        gruendungsjahr: u.gruendungsjahr ?? undefined,
        mitarbeiter: u.mitarbeiter ?? undefined,
        strasse: u.strasse ?? undefined,
        plz: u.plz && /^\d{5}$/.test(u.plz) ? u.plz : undefined,
        ort: u.ort ?? undefined,
        website: u.website && /^https?:\/\//i.test(u.website) ? u.website.slice(0, 200) : undefined,
        kontaktName: u.kontaktName ?? undefined,
        kontaktPosition: u.kontaktPosition ?? undefined,
        kontaktTelefon: u.kontaktTelefon ?? undefined,
        kontaktEmail: u.kontaktEmail ?? undefined,
        benefits: u.benefits.length ? u.benefits.slice(0, 12) : undefined,
        montage: u.montage ?? undefined,
        urlaubstage: u.urlaubstage ?? undefined,
      },
      jobs: extraktion.jobs.length ? extraktion.jobs.map(jobZuDto) : undefined,
    };

    const result = (await backend.adminCreateCompany(payload)) as
      | { id?: string; company?: { id?: string } }
      | undefined;
    const companyId = result?.id ?? result?.company?.id ?? null;

    await recordAudit({
      actorId: employee.id,
      action: "company.created",
      entityType: "company",
      entityId: companyId,
      metadata: { quelle: "ki-intake", firmenname, jobs: extraktion.jobs.length },
    });
    revalidatePath("/unternehmen");
    revalidatePath("/stellen");
    return { ok: true, companyId, jobsAngelegt: extraktion.jobs.length };
  } catch (e) {
    console.error("kiUnternehmenAnlegen failed", e);
    return {
      ok: false,
      fehler:
        "Anlegen über das Plattform-Backend fehlgeschlagen (Render-Server könnte gerade aufwachen) — bitte in ein paar Sekunden erneut versuchen.",
    };
  }
}

/**
 * Jobs an ein BESTEHENDES Unternehmen hängen — über den Admin-Schreibweg des
 * Backends (POST /employer/admin/jobs, source AI). Dieselbe geprüfte Tür wie der
 * Betriebsweg; kein Direkt-SQL auf JobPosting mehr.
 */
export async function kiJobsAnBestehendes(
  companyId: string,
  extraktion: KiExtraktion,
): Promise<AnlegenErgebnis> {
  try {
    const employee = await requirePermission("jobs", "create");
    const [company] = await sql`
      select id from public."Company" where id = ${companyId} limit 1`;
    if (!company) return { ok: false, fehler: "Unternehmen nicht gefunden." };
    if (extraktion.jobs.length === 0) {
      return { ok: false, fehler: "Keine Jobs in der Extraktion." };
    }
    const ohneGewerk = extraktion.jobs.find((j) => !gewerkFuer(j));
    if (ohneGewerk) {
      return {
        ok: false,
        fehler: `Der Stelle „${ohneGewerk.title}" ist kein gültiges Gewerk zugeordnet — bitte im Katalog nachtragen.`,
      };
    }

    let angelegt = 0;
    for (const j of extraktion.jobs) {
      const dto = jobZuDto(j);
      const created = await backend.adminCreateJob(companyId, "AI", dto);
      await recordAudit({
        actorId: employee.id,
        action: "job.created",
        entityType: "job",
        entityId: created.id,
        metadata: { quelle: "ki-intake", companyId, title: dto.title },
      });
      angelegt++;
    }

    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${companyId}`);
    return { ok: true, companyId, jobsAngelegt: angelegt };
  } catch (e) {
    if (e instanceof backend.BackendError) {
      return {
        ok: false,
        fehler:
          e.status === 401 || e.status === 403
            ? "Backend-Zugriff nicht autorisiert — ADMIN_API_KEY prüfen."
            : e.message,
      };
    }
    console.error("kiJobsAnBestehendes failed", e);
    return { ok: false, fehler: "Jobs konnten nicht angelegt werden (Backend nicht erreichbar?)." };
  }
}
