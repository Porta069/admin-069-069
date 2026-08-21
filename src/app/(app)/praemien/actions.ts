"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { backfillPayouts, settlePayout } from "@/lib/payouts";
import * as backend from "@/lib/backend";

type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/praemien");
  revalidatePath("/affiliate");
  revalidatePath("/finanzen");
  revalidatePath("/vermittlungen");
}

/**
 * Prämie als ausgezahlt markieren (Legacy, Referral über Backend). Bleibt für
 * Kompatibilität erhalten; das neue Register nutzt settlePayoutAction.
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
      actorId: employee.id, action: "reward.paid",
      entityType: "referral", entityId: referralId, metadata: { status: "PAID" },
    });
    refresh();
    return { ok: true, message: "Prämie als bezahlt markiert." };
  } catch (e) {
    console.error("markRewardPaid failed", e);
    return { ok: false, message: "Die Prämie konnte nicht aktualisiert werden." };
  }
}

// ── Auszahlungs-Register ─────────────────────────────────────────────────────

/** Register aus allen Quellen befüllen (idempotent). */
export async function generatePayoutsNow(): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    const n = await backfillPayouts();
    await recordAudit({ actorId: employee.id, action: "payouts.generated", entityType: "setting", entityId: "payouts", metadata: { neu: n } });
    refresh();
    return { ok: true, message: n > 0 ? `${n} neue Auszahlung(en) angelegt.` : "Keine neuen Auszahlungen — alles aktuell." };
  } catch (e) {
    console.error("generatePayoutsNow failed", e);
    return { ok: false, message: "Auszahlungen konnten nicht generiert werden." };
  }
}

/** OFFEN → GENEHMIGT. */
export async function approvePayout(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    const rows = await sql`
      update admin.payout set status = 'GENEHMIGT', approved_at = now(), approved_by = ${employee.id}, updated_at = now()
      where id = ${id} and deleted_at is null and status = 'OFFEN' returning id`;
    if (rows.length === 0) return { ok: false, message: "Nur offene Auszahlungen können genehmigt werden." };
    await recordAudit({ actorId: employee.id, action: "payout.approved", entityType: "payout", entityId: id });
    refresh();
    return { ok: true, message: "Auszahlung genehmigt." };
  } catch (e) {
    console.error("approvePayout failed", e);
    return { ok: false, message: "Genehmigung fehlgeschlagen." };
  }
}

/** Bankdaten / Empfänger-E-Mail erfassen. */
export async function setPayoutBankData(
  id: string,
  data: { holder?: string; iban?: string; bic?: string; method?: string; email?: string },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    const iban = (data.iban ?? "").replace(/\s+/g, "").toUpperCase() || null;
    if (iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) {
      return { ok: false, message: "Bitte eine gültige IBAN angeben." };
    }
    const method = ["UEBERWEISUNG", "PAYPAL", "SONSTIGE"].includes(data.method ?? "")
      ? (data.method as string)
      : "UEBERWEISUNG";
    const rows = await sql`
      update admin.payout set
        bank_holder = ${data.holder?.trim() || null},
        bank_iban = ${iban},
        bank_bic = ${data.bic?.trim().toUpperCase() || null},
        method = ${method},
        recipient_email = ${data.email?.trim() || null},
        updated_at = now()
      where id = ${id} and deleted_at is null returning id`;
    if (rows.length === 0) return { ok: false, message: "Auszahlung wurde nicht gefunden." };
    await recordAudit({ actorId: employee.id, action: "payout.bankdata", entityType: "payout", entityId: id });
    refresh();
    return { ok: true, message: "Zahlungsdaten gespeichert." };
  } catch (e) {
    console.error("setPayoutBankData failed", e);
    return { ok: false, message: "Zahlungsdaten konnten nicht gespeichert werden." };
  }
}

/** Auszahlung abschließen (+ Beleg + optional E-Mail). */
export async function settlePayoutAction(
  id: string,
  sendEmail: boolean,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    const r = await settlePayout(id, employee.id, { sendEmail });
    if (!r.ok) return r;
    await recordAudit({
      actorId: employee.id, action: "payout.paid",
      entityType: "payout", entityId: id, metadata: { emailed: r.emailed },
    });
    refresh();
    return { ok: true, message: r.message };
  } catch (e) {
    console.error("settlePayoutAction failed", e);
    return { ok: false, message: "Die Auszahlung konnte nicht abgeschlossen werden." };
  }
}

/** Auszahlung stornieren. */
export async function cancelPayout(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    const rows = await sql`
      update admin.payout set status = 'STORNIERT', updated_at = now()
      where id = ${id} and deleted_at is null and status <> 'AUSGEZAHLT' returning id`;
    if (rows.length === 0) return { ok: false, message: "Eine ausgezahlte Prämie kann nicht storniert werden." };
    await recordAudit({ actorId: employee.id, action: "payout.cancelled", entityType: "payout", entityId: id });
    refresh();
    return { ok: true, message: "Auszahlung storniert." };
  } catch (e) {
    console.error("cancelPayout failed", e);
    return { ok: false, message: "Stornierung fehlgeschlagen." };
  }
}

/** Auszahlungs-Automatisierung an/aus. */
export async function setPayoutAutomation(on: boolean): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "manage");
    await sql`
      insert into admin.setting (key, value) values ('payouts', ${sql.json({ auto: on })})
      on conflict (key) do update set value = ${sql.json({ auto: on })}`;
    await recordAudit({ actorId: employee.id, action: "payouts.automation", entityType: "setting", entityId: "payouts", metadata: { auto: on } });
    refresh();
    return { ok: true, message: on ? "Automatisierung aktiviert." : "Automatisierung deaktiviert." };
  } catch (e) {
    console.error("setPayoutAutomation failed", e);
    return { ok: false, message: "Einstellung konnte nicht gespeichert werden." };
  }
}
