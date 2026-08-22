"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatEuroCents } from "@/lib/format";
import { erstelleAffiliateBonusAufgabe } from "@/lib/rewards";

const PLACEMENT_STATUSES = ["PLACED", "INVOICED", "PAID", "CANCELLED"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

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

export async function createPlacement(input: {
  applicationId: string;
  companyId: string;
  jobPostingId: string | null;
  baseFeeCents: number;
  commissionCents: number;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "create");

    if (!input.applicationId || !input.companyId) {
      return { ok: false, message: "Bitte Kandidat und Unternehmen auswählen." };
    }
    const baseFee = Math.round(input.baseFeeCents);
    const commission = Math.round(input.commissionCents);
    if (
      !Number.isFinite(baseFee) ||
      baseFee < 0 ||
      !Number.isFinite(commission) ||
      commission < 0
    ) {
      return { ok: false, message: "Bitte gültige Beträge angeben." };
    }

    const pricing = await getPricing();
    if (commission > pricing.maxCommissionCents) {
      return {
        ok: false,
        message: `Die Provision darf maximal ${formatEuroCents(pricing.maxCommissionCents)} betragen.`,
      };
    }

    const [candidate] = await sql`
      select id, "firstName" || ' ' || "lastName" as name
      from admin.candidate
      where id = ${input.applicationId} and status <> 'ERASED'
      limit 1`;
    if (!candidate) {
      return { ok: false, message: "Der gewählte Kandidat wurde nicht gefunden." };
    }

    const [company] = await sql`
      select id, name from public."Company" where id = ${input.companyId} limit 1`;
    if (!company) {
      return { ok: false, message: "Das gewählte Unternehmen wurde nicht gefunden." };
    }

    let jobTitle: string | null = null;
    if (input.jobPostingId) {
      const [job] = await sql`
        select title from public."JobPosting"
        where id = ${input.jobPostingId} and "companyId" = ${input.companyId}
        limit 1`;
      jobTitle = (job?.title as string | undefined) ?? null;
    }

    const notes = input.notes?.trim().slice(0, 2000) || null;

    // Idempotenz: keine zweite aktive Vermittlung für denselben Kandidaten
    // (verhindert Doppelklick-Duplikate).
    const [dup] = await sql`
      select id from admin.placement
      where application_id = ${input.applicationId} and status <> 'CANCELLED'
      limit 1`;
    if (dup) {
      return { ok: false, message: "Für diesen Kandidaten besteht bereits eine aktive Vermittlung." };
    }

    const [placement] = await sql`
      insert into admin.placement (
        application_id, candidate_name, company_id, company_name,
        job_posting_id, job_title, employee_id, status, placed_at,
        base_fee_cents, commission_cents, notes, retention_due_at
      ) values (
        ${input.applicationId}, ${candidate.name as string},
        ${input.companyId}, ${company.name as string},
        ${input.jobPostingId}, ${jobTitle}, ${employee.id}, 'PLACED', now(),
        ${baseFee}, ${commission}, ${notes}, now() + interval '56 days'
      )
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "placement.created",
      entityType: "placement",
      entityId: placement.id as string,
      metadata: {
        applicationId: input.applicationId,
        companyId: input.companyId,
        jobPostingId: input.jobPostingId,
        baseFeeCents: baseFee,
        commissionCents: commission,
      },
    });

    // Kandidaten-Pipeline auf VERMITTELT setzen.
    await sql`
      insert into admin.candidate_meta (application_id, status, updated_at)
      values (${input.applicationId}, 'VERMITTELT', now())
      on conflict (application_id)
      do update set status = 'VERMITTELT', updated_at = now()`;

    // €20-Affiliate-Bonus als finanzen-Aufgabe, falls über Affiliate-Link geworben.
    await erstelleAffiliateBonusAufgabe(placement.id as string);

    revalidatePath("/vermittlungen");
    revalidatePath("/aufgaben");
    revalidatePath("/");
    return { ok: true, message: "Vermittlung wurde erfasst." };
  } catch (e) {
    console.error("createPlacement failed", e);
    return {
      ok: false,
      message: "Die Vermittlung konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Treueprämie (200 € nach 8 Wochen) als ausgezahlt markieren. Schließt eine
 * ggf. offene finanzen-Aufgabe „Treueprämie …" für den Kandidaten mit ab.
 */
export async function markRetentionPaid(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "edit");
    const rows = await sql`
      update admin.placement
      set retention_paid_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null and retention_paid_at is null
      returning id, application_id, candidate_name`;
    if (rows.length === 0) {
      return { ok: false, message: "Die Prämie wurde nicht gefunden oder ist bereits ausgezahlt." };
    }
    const pl = rows[0];

    // Offene Treueprämien-Aufgabe für den Kandidaten erledigen.
    if (pl.application_id) {
      await sql`
        update admin.task
        set status = 'DONE', completed_at = now(), updated_at = now()
        where entity_type = 'candidate' and entity_id = ${pl.application_id as string}
          and title like 'Treueprämie%' and status <> 'DONE' and deleted_at is null`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "placement.retention_paid",
      entityType: "placement",
      entityId: id,
      metadata: { candidate: pl.candidate_name },
    });

    revalidatePath("/vermittlungen");
    revalidatePath("/aufgaben");
    return { ok: true, message: "Treueprämie als ausgezahlt markiert." };
  } catch (e) {
    console.error("markRetentionPaid failed", e);
    return { ok: false, message: "Konnte die Prämie nicht als ausgezahlt markieren." };
  }
}

export async function setPlacementStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("placements", "edit");
    if (!PLACEMENT_STATUSES.includes(status as PlacementStatus)) {
      return { ok: false, message: "Ungültiger Status." };
    }

    const rows = await sql`
      update admin.placement
      set status = ${status}, updated_at = now()
      where id = ${id} and deleted_at is null
      returning id`;
    if (rows.length === 0) {
      return { ok: false, message: "Die Vermittlung wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: employee.id,
      action: "placement.status_changed",
      entityType: "placement",
      entityId: id,
      metadata: { status },
    });

    revalidatePath("/vermittlungen");
    return { ok: true, message: "Status aktualisiert." };
  } catch (e) {
    console.error("setPlacementStatus failed", e);
    return {
      ok: false,
      message: "Der Status konnte nicht geändert werden. Bitte erneut versuchen.",
    };
  }
}
