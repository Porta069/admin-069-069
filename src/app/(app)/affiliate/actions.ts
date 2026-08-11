"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatEuroCents } from "@/lib/format";
import * as backend from "@/lib/backend";

const REFERRAL_STATUSES = [
  "REGISTERED",
  "IN_PLACEMENT",
  "PLACED",
  "PAID",
] as const;

type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Statuswechsel eines Referrals — läuft zwingend über die Render-Backend-API,
 * damit die Prämienlogik der Plattform ausgelöst wird (kein direktes SQL!).
 */
export async function changeReferralStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("affiliates", "manage");
    if (
      !REFERRAL_STATUSES.includes(status as (typeof REFERRAL_STATUSES)[number])
    ) {
      return { ok: false, message: "Ungültiger Status." };
    }

    try {
      await backend.setReferralStatus(
        id,
        status as backend.ReferralStatus,
      );
    } catch (e) {
      console.error("backend.setReferralStatus failed", e);
      return {
        ok: false,
        message:
          "Das Backend wacht gerade auf (Render-Kaltstart) — bitte in ein paar Sekunden erneut versuchen.",
      };
    }

    await recordAudit({
      actorId: employee.id,
      action: "referral.status_changed",
      entityType: "referral",
      entityId: id,
      metadata: { status },
    });

    revalidatePath("/affiliate");
    revalidatePath("/praemien");

    if (status === "PLACED") {
      const rows = await sql`select value from admin.setting where key = 'pricing'`;
      const value = (rows[0]?.value ?? {}) as Record<string, unknown>;
      const rewardCents =
        typeof value.referral_reward_cents === "number"
          ? value.referral_reward_cents
          : 10000;
      return {
        ok: true,
        message: `Referral vermittelt — Prämie über ${formatEuroCents(rewardCents)} wird fällig.`,
      };
    }

    return { ok: true, message: "Referral-Status aktualisiert." };
  } catch (e) {
    console.error("changeReferralStatus failed", e);
    return {
      ok: false,
      message: "Der Status konnte nicht geändert werden. Bitte erneut versuchen.",
    };
  }
}
