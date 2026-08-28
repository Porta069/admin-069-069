"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { labelFuer } from "@/lib/matching/catalog";
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
    const gewerk = k.gewerk ? labelFuer("gewerk", k.gewerk) : "Handwerk";
    const id = crypto.randomUUID();
    const city = (company.ort as string | null)?.trim() || "";

    await sql`
      insert into public."JobPosting"
        (id, "companyId", title, gewerk, city, "createdAt", "updatedAt",
         gewerke, berufe, "abschlussMin", aufgaben, "aufgabenMin", "bezeichnungTags",
         "erfahrungMin", "montageMin", "fuehrerscheinMin", "deutschMin",
         gebotenes, "startBis")
      values (
        ${id}, ${companyId}, ${t}, ${gewerk}, ${city}, now(), now(),
        ${anf.gewerke}, ${anf.berufe}, ${anf.abschlussMin},
        ${anf.aufgaben}, ${anf.aufgabenMin}, ${anf.bezeichnungTags},
        ${anf.erfahrungMin}, ${anf.montageMin}, ${anf.fuehrerscheinMin},
        ${anf.deutschMin}, ${anf.gebotenes}, ${anf.startBis})`;

    await recordAudit({
      actorId: employee.id,
      action: "job.created_from_search",
      entityType: "job",
      entityId: id,
      metadata: { companyId, title: t, gewerk },
    });

    revalidatePath("/stellen");
    revalidatePath(`/unternehmen/${companyId}`);
    return {
      ok: true,
      jobId: id,
      message: `Stelle „${t}" angelegt und ${company.name as string} zugeordnet.`,
    };
  } catch (e) {
    console.error("speichereAlsStelle failed", e);
    return { ok: false, message: "Die Stelle konnte nicht gespeichert werden." };
  }
}
