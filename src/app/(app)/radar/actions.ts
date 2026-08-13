"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

interface SuggestionRow {
  id: string;
  application_id: string;
  candidate_name: string | null;
  job_posting_id: string;
  job_title: string | null;
  company_id: string | null;
  company_name: string | null;
  match_score: number | null;
  status: string;
}

/**
 * Übernimmt einen erkannten Vorschlag in den Angebots-Workflow: legt eine
 * admin.proposal an (sofern noch keine existiert) und markiert die Suggestion
 * als VORGESCHLAGEN. Idempotent gegenüber Doppelklicks/Bulk-Overlap.
 */
async function promoteOne(
  actorId: string,
  id: string,
): Promise<{ promoted: boolean; skipped: boolean }> {
  const [row] = (await sql`
    select id, application_id, candidate_name, job_posting_id, job_title,
           company_id, company_name, match_score, status
    from admin.match_suggestion
    where id = ${id}`) as unknown as SuggestionRow[];

  if (!row) return { promoted: false, skipped: true };
  // Bereits behandelt → nichts tun (Bulk-Overlap, doppelter Klick).
  if (row.status === "VORGESCHLAGEN" || row.status === "VERWORFEN") {
    return { promoted: false, skipped: true };
  }

  const existing = await sql`
    select id from admin.proposal
    where application_id = ${row.application_id}
      and job_posting_id = ${row.job_posting_id}
      and deleted_at is null
    limit 1`;

  let proposalId: string | null =
    existing.length > 0 ? (existing[0].id as string) : null;

  if (!proposalId) {
    const [created] = await sql`
      insert into admin.proposal (
        application_id, candidate_name, job_posting_id, job_title,
        company_id, company_name, employee_id, match_score, status
      ) values (
        ${row.application_id}, ${row.candidate_name}, ${row.job_posting_id},
        ${row.job_title}, ${row.company_id}, ${row.company_name},
        ${actorId}, ${row.match_score}, 'VORGESCHLAGEN'
      )
      returning id`;
    proposalId = created.id as string;
  }

  await sql`
    update admin.match_suggestion
    set status = 'VORGESCHLAGEN',
        handled_at = now(),
        assignee_id = coalesce(assignee_id, ${actorId})
    where id = ${id}`;

  await recordAudit({
    actorId,
    action: "match_suggestion.promoted",
    entityType: "candidate",
    entityId: row.application_id,
    metadata: {
      suggestionId: id,
      proposalId,
      jobPostingId: row.job_posting_id,
      matchScore: row.match_score,
    },
  });

  return { promoted: true, skipped: false };
}

export async function uebernehmenSuggestion(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("matching", "edit");
    const result = await promoteOne(actor.id, id);
    if (!result.promoted && result.skipped) {
      return {
        ok: false,
        message: "Vorschlag wurde bereits behandelt.",
      };
    }
    revalidatePath("/radar");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Vorschlag konnte nicht übernommen werden."),
    };
  }
}

export async function verwerfenSuggestion(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("matching", "edit");
    const updated = await sql`
      update admin.match_suggestion
      set status = 'VERWORFEN', handled_at = now()
      where id = ${id} and status in ('NEU', 'GESICHTET')
      returning id, application_id, job_posting_id`;
    if (updated.length === 0) {
      return { ok: false, message: "Vorschlag wurde bereits behandelt." };
    }
    await recordAudit({
      actorId: actor.id,
      action: "match_suggestion.dismissed",
      entityType: "candidate",
      entityId: updated[0].application_id as string,
      metadata: {
        suggestionId: id,
        jobPostingId: updated[0].job_posting_id,
      },
    });
    revalidatePath("/radar");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Vorschlag konnte nicht verworfen werden."),
    };
  }
}

export async function bulkUebernehmen(
  ids: string[],
): Promise<{ ok: boolean; message?: string }> {
  try {
    const actor = await requirePermission("matching", "edit");
    let count = 0;
    for (const id of ids) {
      const result = await promoteOne(actor.id, id);
      if (result.promoted) count++;
    }
    revalidatePath("/radar");
    if (count === 0) {
      return { ok: false, message: "Keine offenen Vorschläge übernommen." };
    }
    return { ok: true, message: `${count} als Vorschlag übernommen` };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Übernahme fehlgeschlagen."),
    };
  }
}

export async function bulkVerwerfen(
  ids: string[],
): Promise<{ ok: boolean; message?: string }> {
  try {
    const actor = await requirePermission("matching", "edit");
    if (ids.length === 0) {
      return { ok: false, message: "Keine Vorschläge ausgewählt." };
    }
    const updated = await sql`
      update admin.match_suggestion
      set status = 'VERWORFEN', handled_at = now()
      where id = any(${ids}) and status in ('NEU', 'GESICHTET')
      returning id`;
    await recordAudit({
      actorId: actor.id,
      action: "match_suggestion.dismissed_bulk",
      entityType: "matching",
      entityId: null,
      metadata: { count: updated.length },
    });
    revalidatePath("/radar");
    if (updated.length === 0) {
      return { ok: false, message: "Keine offenen Vorschläge verworfen." };
    }
    return { ok: true, message: `${updated.length} verworfen` };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Verwerfen fehlgeschlagen."),
    };
  }
}

export async function saveRadarSettings(input: {
  schwelle: number;
  topN: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("matching", "manage");
    const schwelle = Math.round(input.schwelle);
    const topN = Math.round(input.topN);
    if (!Number.isFinite(schwelle) || schwelle < 0 || schwelle > 100) {
      return { ok: false, message: "Schwelle muss zwischen 0 und 100 liegen." };
    }
    if (!Number.isFinite(topN) || topN < 1 || topN > 50) {
      return { ok: false, message: "Top-N muss zwischen 1 und 50 liegen." };
    }
    await sql`
      insert into admin.setting (key, value)
      values ('radar', ${sql.json({ schwelle, top_n: topN })})
      on conflict (key) do update set value = ${sql.json({
        schwelle,
        top_n: topN,
      })}`;
    await recordAudit({
      actorId: actor.id,
      action: "settings.radar_updated",
      entityType: "settings",
      entityId: "radar",
      metadata: { schwelle, top_n: topN },
    });
    revalidatePath("/radar");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Einstellungen konnten nicht gespeichert werden."),
    };
  }
}
