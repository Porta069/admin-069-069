"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import * as backend from "@/lib/backend";

type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Prämie als ausgezahlt markieren — läuft über die Render-Backend-API
 * (setReferralStatus PAID), damit die Plattform-Prämienlogik greift.
 */
export async function markRewardPaid(referralId: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");

    try {
      await backend.setReferralStatus(referralId, "PAID");
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
      action: "reward.paid",
      entityType: "referral",
      entityId: referralId,
      metadata: { status: "PAID" },
    });

    revalidatePath("/praemien");
    revalidatePath("/affiliate");
    return { ok: true, message: "Prämie als bezahlt markiert." };
  } catch (e) {
    console.error("markRewardPaid failed", e);
    return {
      ok: false,
      message: "Die Prämie konnte nicht aktualisiert werden. Bitte erneut versuchen.",
    };
  }
}
