"use server";

import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { kiJson } from "@/lib/ki";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { professionLabel } from "@/lib/matching/anzeige";

export type SummaryResult =
  | { ok: true; stand: string; naechsterSchritt: string }
  | { ok: false; message: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stand: { type: "string", description: "1–2 Sätze: aktueller Stand des Kandidaten." },
    naechster_schritt: { type: "string", description: "1 Satz: konkret empfohlener nächster Schritt." },
  },
  required: ["stand", "naechster_schritt"],
} as const;

/**
 * KI-Kurzzusammenfassung eines Kandidaten — NUR auf Knopfdruck. Fasst Historie
 * (Status, Notizen, Anrufe, Kommunikation) zu „Stand & nächster Schritt" zusammen.
 */
export async function kandidatZusammenfassung(applicationId: string): Promise<SummaryResult> {
  try {
    const employee = await requirePermission("candidates", "view");

    const [c] = await sql`
      select a."firstName", a."lastName", a.profession, a."federalState", a."birthYear",
             a.availability, cm.status as pipeline_status, cm.priority
      from admin.candidate a
      left join admin.candidate_meta cm on cm.application_id = a.id
      where a.id = ${applicationId} and a.status <> 'ERASED' limit 1`;
    if (!c) return { ok: false, message: "Kandidat nicht gefunden." };

    const [notizen, calls, komm] = await Promise.all([
      sql`select content, created_at from admin.note
          where entity_type='candidate' and entity_id=${applicationId} and deleted_at is null
          order by created_at desc limit 8`,
      sql`select ergebnis, notiz, completed_at from admin.call_session
          where application_id=${applicationId} and deleted_at is null
          order by created_at desc limit 5`,
      sql`select channel, direction, subject, occurred_at from admin.communication
          where entity_type='candidate' and entity_id=${applicationId} and deleted_at is null
          order by occurred_at desc limit 8`,
    ]);

    const name = `${(c.firstName as string) ?? ""} ${(c.lastName as string) ?? ""}`.trim() || "Kandidat";
    const statusLabel =
      CANDIDATE_STATUS[(c.pipeline_status as string) ?? "NEU"]?.label ?? c.pipeline_status ?? "Neu";
    const kontext = [
      `Name: ${name}`,
      `Beruf: ${professionLabel(c.profession as string) ?? "—"} · Bundesland: ${(c.federalState as string) ?? "—"}`,
      `Aktueller Status: ${statusLabel} · Priorität: ${(c.priority as string) ?? "NORMAL"}`,
      "",
      "Anrufe (neueste zuerst):",
      ...(calls.length
        ? calls.map((k) => `- ${k.ergebnis ?? "?"}: ${(k.notiz as string) ?? "(keine Notiz)"}`)
        : ["- keine"]),
      "",
      "Notizen:",
      ...(notizen.length ? notizen.map((n) => `- ${(n.content as string).slice(0, 240)}`) : ["- keine"]),
      "",
      "Kommunikation:",
      ...(komm.length
        ? komm.map((k) => `- ${k.direction}/${k.channel}: ${(k.subject as string) ?? ""}`)
        : ["- keine"]),
    ].join("\n");

    const res = await kiJson<{ stand: string; naechster_schritt: string }>({
      feature: "kandidat_summary",
      stufe: "guenstig",
      system:
        "Du fasst für einen Recruiting-Mitarbeiter einen Handwerker-Kandidaten knapp zusammen. " +
        "Antworte NUR mit dem JSON-Schema: `stand` (aktueller Stand, 1–2 Sätze) und " +
        "`naechster_schritt` (ein konkreter, umsetzbarer nächster Schritt). Deutsch, sachlich, kurz.",
      user: kontext,
      schema: SCHEMA,
      actorId: employee.id,
      maxTokens: 400,
    });

    if (!res.ok) return { ok: false, message: res.fehler };
    return { ok: true, stand: res.data.stand, naechsterSchritt: res.data.naechster_schritt };
  } catch (e) {
    console.error("kandidatZusammenfassung failed", e);
    return { ok: false, message: "Zusammenfassung fehlgeschlagen." };
  }
}
