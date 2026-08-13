"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatEuroCents } from "@/lib/format";
import { rankCandidatesForJob } from "@/lib/matching/rank";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Status, die per Dropdown ohne Zusatzdialog gesetzt werden dürfen. */
const SIMPLE_STATUSES = [
  "VORGESCHLAGEN",
  "BETRIEB_INTERESSIERT",
  "ANGENOMMEN",
];

async function getPricing(): Promise<{
  baseFeeCents: number;
  maxCommissionCents: number;
}> {
  const rows = await sql`select value from admin.setting where key = 'pricing'`;
  const value = (rows[0]?.value ?? {}) as Record<string, unknown>;
  return {
    baseFeeCents:
      typeof value.base_fee_cents === "number" ? value.base_fee_cents : 4900,
    maxCommissionCents:
      typeof value.max_commission_cents === "number"
        ? value.max_commission_cents
        : 250000,
  };
}

/**
 * Vorschlag manuell erstellen: Kandidat + Job wählen, Match-Score
 * deterministisch über die Engine ermitteln (kostenlos, keine KI).
 */
export async function createProposal(input: {
  applicationId: string;
  jobPostingId: string;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "create");

    if (!input.applicationId || !input.jobPostingId) {
      return { ok: false, message: "Bitte Kandidat und Stelle auswählen." };
    }

    const [candidate] = await sql`
      select id, "firstName" || ' ' || "lastName" as name
      from admin.candidate
      where id = ${input.applicationId} and status <> 'ERASED'
      limit 1`;
    if (!candidate) {
      return { ok: false, message: "Der gewählte Kandidat wurde nicht gefunden." };
    }

    const [job] = await sql`
      select j.id, j.title, j."companyId", c.name as company_name
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.id = ${input.jobPostingId}
      limit 1`;
    if (!job) {
      return { ok: false, message: "Die gewählte Stelle wurde nicht gefunden." };
    }

    // Kein doppelter offener Vorschlag für dasselbe Paar.
    const existing = await sql`
      select id from admin.proposal
      where application_id = ${input.applicationId}
        and job_posting_id = ${input.jobPostingId}
        and deleted_at is null
      limit 1`;
    if (existing.length > 0) {
      return {
        ok: false,
        message: "Für diesen Kandidaten und diese Stelle gibt es bereits einen Vorschlag.",
      };
    }

    // Deterministischer Score über die Matching-Engine.
    let matchScore: number | null = null;
    try {
      const ranked = await rankCandidatesForJob(input.jobPostingId);
      const hit = ranked?.bewertet.find(
        (b) => b.applicationId === input.applicationId,
      );
      matchScore = hit ? Math.round(hit.breakdown.score) : null;
    } catch (err) {
      console.error("score computation failed", err);
    }

    const [proposal] = await sql`
      insert into admin.proposal (
        application_id, candidate_name, job_posting_id, job_title,
        company_id, company_name, employee_id, match_score, status
      ) values (
        ${input.applicationId}, ${candidate.name as string},
        ${input.jobPostingId}, ${job.title as string},
        ${(job.companyId as string) ?? null}, ${(job.company_name as string) ?? null},
        ${employee.id}, ${matchScore}, 'VORGESCHLAGEN'
      )
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "proposal.created",
      entityType: "placement",
      entityId: proposal.id as string,
      metadata: {
        applicationId: input.applicationId,
        jobPostingId: input.jobPostingId,
        matchScore,
      },
    });

    revalidatePath("/vorschlaege");
    return { ok: true, message: "Vorschlag wurde erstellt." };
  } catch (e) {
    console.error("createProposal failed", e);
    return {
      ok: false,
      message: "Der Vorschlag konnte nicht erstellt werden. Bitte erneut versuchen.",
    };
  }
}

export async function setProposalStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "edit");
    if (!SIMPLE_STATUSES.includes(status)) {
      return { ok: false, message: "Ungültiger Status für diese Aktion." };
    }

    const rows = await sql`
      update admin.proposal
      set status = ${status}, updated_at = now()
      where id = ${id} and deleted_at is null
      returning id`;
    if (rows.length === 0) {
      return { ok: false, message: "Der Vorschlag wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: employee.id,
      action: "proposal.status_changed",
      entityType: "placement",
      entityId: id,
      metadata: { status },
    });

    revalidatePath("/vorschlaege");
    return { ok: true, message: "Status aktualisiert." };
  } catch (e) {
    console.error("setProposalStatus failed", e);
    return {
      ok: false,
      message: "Der Status konnte nicht geändert werden. Bitte erneut versuchen.",
    };
  }
}

/** Angebot an den Betrieb hinterlegen → Status ANGEBOT, offer_at gesetzt. */
export async function sendOffer(
  id: string,
  offerMessage: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "edit");
    const message = offerMessage.trim().slice(0, 4000);
    if (!message) {
      return { ok: false, message: "Bitte eine Angebots-Nachricht eingeben." };
    }

    const rows = await sql`
      update admin.proposal
      set status = 'ANGEBOT', offer_message = ${message}, offer_at = now(),
          updated_at = now()
      where id = ${id} and deleted_at is null
      returning id`;
    if (rows.length === 0) {
      return { ok: false, message: "Der Vorschlag wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: employee.id,
      action: "proposal.offer_sent",
      entityType: "placement",
      entityId: id,
      metadata: {},
    });

    revalidatePath("/vorschlaege");
    return { ok: true, message: "Angebot hinterlegt." };
  } catch (e) {
    console.error("sendOffer failed", e);
    return {
      ok: false,
      message: "Das Angebot konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }
}

/** Ablehnung mit Grund festhalten → Status ABGELEHNT. */
export async function declineProposal(
  id: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "edit");
    const declineReason = reason.trim().slice(0, 2000) || null;

    const rows = await sql`
      update admin.proposal
      set status = 'ABGELEHNT', decline_reason = ${declineReason}, updated_at = now()
      where id = ${id} and deleted_at is null
      returning id`;
    if (rows.length === 0) {
      return { ok: false, message: "Der Vorschlag wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: employee.id,
      action: "proposal.declined",
      entityType: "placement",
      entityId: id,
      metadata: { reason: declineReason },
    });

    revalidatePath("/vorschlaege");
    return { ok: true, message: "Vorschlag abgelehnt." };
  } catch (e) {
    console.error("declineProposal failed", e);
    return {
      ok: false,
      message: "Die Ablehnung konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * „Vermittelt": legt aus dem Vorschlag eine admin.placement an, überträgt
 * proposal.match_score → placement.match_score, setzt candidate_meta auf
 * VERMITTELT und den Vorschlag selbst auf VERMITTELT.
 */
export async function markProposalPlaced(input: {
  id: string;
  commissionCents: number;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "create");

    const commission = Math.round(input.commissionCents);
    if (!Number.isFinite(commission) || commission < 0) {
      return { ok: false, message: "Bitte eine gültige Provision angeben." };
    }
    const pricing = await getPricing();
    if (commission > pricing.maxCommissionCents) {
      return {
        ok: false,
        message: `Die Provision darf maximal ${formatEuroCents(pricing.maxCommissionCents)} betragen.`,
      };
    }

    const [proposal] = await sql`
      select id, application_id, candidate_name, company_id, company_name,
             job_posting_id, job_title, match_score, status
      from admin.proposal
      where id = ${input.id} and deleted_at is null
      limit 1`;
    if (!proposal) {
      return { ok: false, message: "Der Vorschlag wurde nicht gefunden." };
    }
    if (proposal.status === "VERMITTELT") {
      return { ok: false, message: "Dieser Vorschlag ist bereits vermittelt." };
    }

    const notes = input.notes?.trim().slice(0, 2000) || null;

    const [placement] = await sql`
      insert into admin.placement (
        application_id, candidate_name, company_id, company_name,
        job_posting_id, job_title, employee_id, status, placed_at,
        base_fee_cents, commission_cents, match_score, notes
      ) values (
        ${proposal.application_id}, ${proposal.candidate_name},
        ${proposal.company_id}, ${proposal.company_name},
        ${proposal.job_posting_id}, ${proposal.job_title}, ${employee.id},
        'PLACED', now(), ${pricing.baseFeeCents}, ${commission},
        ${proposal.match_score}, ${notes}
      )
      returning id`;

    await sql`
      update admin.proposal
      set status = 'VERMITTELT', updated_at = now()
      where id = ${input.id}`;

    // Kandidaten-Pipeline auf VERMITTELT setzen.
    if (proposal.application_id) {
      await sql`
        insert into admin.candidate_meta (application_id, status, updated_at)
        values (${proposal.application_id}, 'VERMITTELT', now())
        on conflict (application_id)
        do update set status = 'VERMITTELT', updated_at = now()`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "placement.created",
      entityType: "placement",
      entityId: placement.id as string,
      metadata: {
        fromProposalId: input.id,
        matchScore: proposal.match_score,
        commissionCents: commission,
      },
    });

    revalidatePath("/vorschlaege");
    revalidatePath("/vermittlungen");
    revalidatePath("/");
    return { ok: true, message: "Vermittlung wurde angelegt." };
  } catch (e) {
    console.error("markProposalPlaced failed", e);
    return {
      ok: false,
      message: "Die Vermittlung konnte nicht angelegt werden. Bitte erneut versuchen.",
    };
  }
}

