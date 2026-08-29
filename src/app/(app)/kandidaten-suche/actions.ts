"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { adminCreateJob, BackendError } from "@/lib/backend";
import {
  rankCandidatesForKriterien,
  kriterienZuStelle,
  type SuchKriterien,
  type SuchErgebnis,
} from "@/lib/matching/kriterien-suche";

function sanitize(k: Partial<SuchKriterien>): SuchKriterien {
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  const a = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, 40)
      : [];
  return {
    gewerk: s(k.gewerk),
    abschluss: s(k.abschluss),
    ausbildungsberuf: s(k.ausbildungsberuf),
    berufsbezeichnung: s(k.berufsbezeichnung),
    aufgaben: a(k.aufgaben),
    erfahrung: s(k.erfahrung),
    wuensche: a(k.wuensche),
    montage: s(k.montage),
    fuehrerschein: s(k.fuehrerschein),
    deutsch: s(k.deutsch),
    start: s(k.start),
  };
}

/** Live-Suche: Kriterien → gewichtetes Kandidaten-Ranking. */
export async function sucheKandidaten(
  kriterien: Partial<SuchKriterien>,
): Promise<{ ok: true; ergebnis: SuchErgebnis } | { ok: false; message: string }> {
  try {
    await requireEmployee("matching");
    const ergebnis = await rankCandidatesForKriterien(sanitize(kriterien), 100);
    return { ok: true, ergebnis };
  } catch (e) {
    console.error("sucheKandidaten failed", e);
    return { ok: false, message: "Die Suche konnte nicht ausgeführt werden." };
  }
}

/** Kriterien als Stellenanzeige speichern und einem Unternehmen zuordnen. */
export async function speichereAlsStelle(
  kriterien: Partial<SuchKriterien>,
  companyId: string,
  title: string,
): Promise<
  { ok: true; jobId: string; message: string } | { ok: false; message: string }
> {
  try {
    const employee = await requirePermission("jobs", "create");
    const t = title.trim().slice(0, 200);
    if (!t) return { ok: false, message: "Bitte einen Titel für die Stelle angeben." };
    if (!companyId) return { ok: false, message: "Bitte ein Unternehmen auswählen." };

    const [company] = await sql`
      select id, name, ort from public."Company" where id = ${companyId} limit 1`;
    if (!company)
      return { ok: false, message: "Das gewählte Unternehmen wurde nicht gefunden." };

    const k = sanitize(kriterien);
    const anf = kriterienZuStelle(k);
    // gewerk = Katalog-WERT (nicht Label): gewähltes Gewerk, sonst erstes akzeptiertes.
    const gewerk = k.gewerk ?? anf.gewerke[0] ?? null;
    if (!gewerk) {
      return {
        ok: false,
        message: "Bitte in der Suche ein Gewerk wählen, um daraus eine Stelle anzulegen.",
      };
    }
    const city = (company.ort as string | null)?.trim() || undefined;

    // Über den Admin-Schreibweg des Backends (source ADMIN) — geprüft wie der
    // Betriebsweg, kein Direkt-SQL. Nur SaveJobDto-Felder senden.
    const created = await adminCreateJob(companyId, "ADMIN", {
      title: t,
      gewerk,
      gewerke: anf.gewerke,
      city,
      status: "DRAFT" as const,
      berufe: anf.berufe,
      abschlussMin: anf.abschlussMin,
      aufgaben: anf.aufgaben,
      aufgabenMin: anf.aufgabenMin,
      bezeichnungTags: anf.bezeichnungTags,
      erfahrungMin: anf.erfahrungMin,
      erfahrungMax: anf.erfahrungMax,
      montageMin: anf.montageMin,
      fuehrerscheinMin: anf.fuehrerscheinMin,
      deutschMin: anf.deutschMin,
      gebotenes: anf.gebotenes,
      startBis: anf.startBis,
    });

    await recordAudit({
      actorId: employee.id,
      action: "job.created_from_search",
      entityType: "job",
      entityId: created.id,
      metadata: { companyId, title: t, gewerk },
    });

    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${companyId}`);
    return {
      ok: true,
      jobId: created.id,
      message: `Stelle „${t}" angelegt und ${company.name as string} zugeordnet.`,
    };
  } catch (e) {
    if (e instanceof BackendError) {
      return {
        ok: false,
        message:
          e.status === 401 || e.status === 403
            ? "Backend-Zugriff nicht autorisiert — ADMIN_API_KEY prüfen."
            : e.message,
      };
    }
    console.error("speichereAlsStelle failed", e);
    return { ok: false, message: "Die Stelle konnte nicht gespeichert werden (Backend nicht erreichbar?)." };
  }
}
