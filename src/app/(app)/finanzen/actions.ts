"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/**
 * Rechnung aus einer Vermittlung erstellen. Rechnungsnummer via
 * nextval('admin.invoice_seq') → Format RE-<Jahr>-<Seq>. Beträge aus der
 * placement, Zahlungsziel +14 Tage.
 */
export async function createInvoice(
  placementId: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "create");

    if (!placementId) {
      return { ok: false, message: "Bitte eine Vermittlung auswählen." };
    }

    const [placement] = await sql`
      select id, company_id, company_name, base_fee_cents, commission_cents, status
      from admin.placement
      where id = ${placementId} and deleted_at is null
      limit 1`;
    if (!placement) {
      return { ok: false, message: "Die gewählte Vermittlung wurde nicht gefunden." };
    }
    if (placement.status === "CANCELLED") {
      return {
        ok: false,
        message: "Für eine stornierte Vermittlung kann keine Rechnung erstellt werden.",
      };
    }

    const existing = await sql`
      select id from admin.invoice
      where placement_id = ${placementId} and deleted_at is null
        and status <> 'STORNIERT'
      limit 1`;
    if (existing.length > 0) {
      return {
        ok: false,
        message: "Für diese Vermittlung existiert bereits eine Rechnung.",
      };
    }

    const baseFee = Number(placement.base_fee_cents ?? 0);
    const commission = Number(placement.commission_cents ?? 0);
    const total = baseFee + commission;
    const positionen = [
      {
        bezeichnung: "Vermittlungspauschale (Grundgebühr)",
        menge: 1,
        einzelpreis_cents: baseFee,
        betrag_cents: baseFee,
      },
      ...(commission > 0
        ? [
            {
              bezeichnung: "Erfolgsprovision",
              menge: 1,
              einzelpreis_cents: commission,
              betrag_cents: commission,
            },
          ]
        : []),
    ];

    // Nummer inline mit nextval → atomar in einem Statement (keine Lücken-Logik nötig).
    const [invoice] = await sql`
      insert into admin.invoice (
        nummer, art, placement_id, company_id, company_name, recipient_name,
        base_fee_cents, commission_cents, total_cents, positionen, status,
        issued_at, service_date, due_at, created_by
      ) values (
        'RE-' || extract(year from (now() at time zone 'Europe/Berlin'))::int
          || '-' || nextval('admin.invoice_seq'),
        'VERMITTLUNG', ${placementId}, ${placement.company_id}, ${placement.company_name},
        ${placement.company_name},
        ${baseFee}, ${commission}, ${total}, ${sql.json(positionen)}, 'OFFEN',
        now(), current_date, now() + interval '14 days', ${employee.id}
      )
      returning id, nummer`;

    // Vermittlung als abgerechnet markieren, wenn sie noch offen war.
    await sql`
      update admin.placement
      set status = 'INVOICED', updated_at = now()
      where id = ${placementId} and status = 'PLACED'`;

    await recordAudit({
      actorId: employee.id,
      action: "invoice.created",
      entityType: "placement",
      entityId: placementId,
      metadata: {
        invoiceId: invoice.id,
        nummer: invoice.nummer,
        totalCents: total,
      },
    });

    revalidatePath("/finanzen");
    revalidatePath("/vermittlungen");
    return {
      ok: true,
      message: `Rechnung ${invoice.nummer as string} wurde erstellt.`,
    };
  } catch (e) {
    console.error("createInvoice failed", e);
    return {
      ok: false,
      message: "Die Rechnung konnte nicht erstellt werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Rechnung/Abrechnung aus einem Empfehlungs-Vorgang (Referral). Empfänger ist
 * der werbende Partner; abgerechnet wird die Empfehlungsprämie (rewardCents).
 */
export async function createReferralInvoice(
  referralId: string,
): Promise<ActionResult & { invoiceId?: string }> {
  try {
    const employee = await requirePermission("rewards", "create");
    if (!referralId) return { ok: false, message: "Bitte eine Empfehlung auswählen." };

    const [ref] = await sql`
      select r.id, r."candidateName", r."candidateTrade", r."rewardCents",
             r.status, r."partnerId", p.name as partner_name
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where r.id = ${referralId} limit 1`;
    if (!ref) return { ok: false, message: "Die gewählte Empfehlung wurde nicht gefunden." };

    const existing = await sql`
      select id from admin.invoice
      where referral_id = ${referralId} and deleted_at is null and status <> 'STORNIERT'
      limit 1`;
    if (existing.length > 0) {
      return { ok: false, message: "Für diese Empfehlung existiert bereits eine Abrechnung." };
    }

    const reward = Number(ref.rewardCents ?? 0);
    const partnerName = (ref.partner_name as string | null) ?? "Partner";
    const kandidat = (ref.candidateName as string | null) ?? "Kandidat";
    const gewerk = ref.candidateTrade ? ` (${ref.candidateTrade as string})` : "";
    const positionen = [
      {
        bezeichnung: `Empfehlungsprämie — ${kandidat}${gewerk}`,
        menge: 1,
        einzelpreis_cents: reward,
        betrag_cents: reward,
      },
    ];

    const [invoice] = await sql`
      insert into admin.invoice (
        nummer, art, referral_id, company_name, recipient_name,
        base_fee_cents, commission_cents, total_cents, positionen, status,
        issued_at, service_date, due_at, created_by
      ) values (
        'EA-' || extract(year from (now() at time zone 'Europe/Berlin'))::int
          || '-' || nextval('admin.invoice_seq'),
        'REFERRAL', ${referralId}, ${partnerName}, ${partnerName},
        ${reward}, 0, ${reward}, ${sql.json(positionen)}, 'OFFEN',
        now(), current_date, now() + interval '14 days', ${employee.id}
      )
      returning id, nummer`;

    await recordAudit({
      actorId: employee.id,
      action: "invoice.created",
      entityType: "referral",
      entityId: referralId,
      metadata: { invoiceId: invoice.id, nummer: invoice.nummer, art: "REFERRAL", totalCents: reward },
    });

    revalidatePath("/finanzen");
    revalidatePath("/affiliate");
    return {
      ok: true,
      message: `Empfehlungsabrechnung ${invoice.nummer as string} wurde erstellt.`,
      invoiceId: invoice.id as string,
    };
  } catch (e) {
    console.error("createReferralInvoice failed", e);
    return { ok: false, message: "Die Abrechnung konnte nicht erstellt werden. Bitte erneut versuchen." };
  }
}

/**
 * Manuelle Rechnung (Premium-Account oder Sonstige) mit frei erfassten
 * Positionen und optionaler USt. Nettosumme aus den Positionen, Steuer
 * aufgeschlagen.
 */
export async function createManualInvoice(payload: {
  art: string;
  companyId?: string | null;
  recipientName: string;
  recipientAddress?: string | null;
  taxRate?: number;
  dueDays?: number;
  notes?: string | null;
  positionen: { bezeichnung: string; menge: number; einzelpreisCents: number }[];
  /** Optional: Herkunft einer Provisionsberechnung zur Nachvollziehbarkeit. */
  annualSalaryCents?: number | null;
  provisionPercent?: number | null;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "create");

    const art = ["VERMITTLUNG", "PREMIUM", "REFERRAL", "SONSTIGE"].includes(payload.art)
      ? payload.art
      : "SONSTIGE";
    const recipient = payload.recipientName?.trim();
    if (!recipient) return { ok: false, message: "Bitte einen Rechnungsempfänger angeben." };

    const positionen = (payload.positionen ?? [])
      .map((p) => {
        const menge = Math.max(1, Math.round(Number(p.menge) || 1));
        const einzel = Math.round(Number(p.einzelpreisCents) || 0);
        return {
          bezeichnung: (p.bezeichnung ?? "").trim(),
          menge,
          einzelpreis_cents: einzel,
          betrag_cents: menge * einzel,
        };
      })
      .filter((p) => p.bezeichnung && p.betrag_cents > 0);
    if (positionen.length === 0) {
      return { ok: false, message: "Bitte mindestens eine Position mit Betrag erfassen." };
    }

    const netto = positionen.reduce((s, p) => s + p.betrag_cents, 0);
    const taxRate = Math.min(100, Math.max(0, Math.round(Number(payload.taxRate) || 0)));
    const steuer = Math.round((netto * taxRate) / 100);
    const total = netto + steuer;
    const dueDays = Math.max(0, Math.round(Number(payload.dueDays) || 14));

    let companyName = recipient;
    if (payload.companyId) {
      const [co] = await sql`select name from public."Company" where id = ${payload.companyId} limit 1`;
      if (co?.name) companyName = co.name as string;
    }

    const annualSalary =
      payload.annualSalaryCents != null && payload.annualSalaryCents > 0
        ? Math.round(payload.annualSalaryCents)
        : null;
    const provisionPercent =
      payload.provisionPercent != null && payload.provisionPercent > 0
        ? Math.round(payload.provisionPercent * 100) / 100
        : null;

    const [invoice] = await sql`
      insert into admin.invoice (
        nummer, art, company_id, company_name, recipient_name, recipient_address,
        base_fee_cents, commission_cents, total_cents, tax_rate, positionen,
        annual_salary_cents, provision_percent,
        notes, status, issued_at, service_date, due_at, created_by
      ) values (
        'RE-' || extract(year from (now() at time zone 'Europe/Berlin'))::int
          || '-' || nextval('admin.invoice_seq'),
        ${art}, ${payload.companyId ?? null}, ${companyName}, ${recipient},
        ${payload.recipientAddress?.trim() || null},
        ${netto}, 0, ${total}, ${taxRate}, ${sql.json(positionen)},
        ${annualSalary}, ${provisionPercent},
        ${payload.notes?.trim() || null}, 'OFFEN', now(), current_date,
        now() + (${dueDays} || ' days')::interval, ${employee.id}
      )
      returning id, nummer`;

    await recordAudit({
      actorId: employee.id,
      action: "invoice.created",
      entityType: payload.companyId ? "company" : "invoice",
      entityId: payload.companyId ?? (invoice.id as string),
      metadata: { invoiceId: invoice.id, nummer: invoice.nummer, art, totalCents: total },
    });

    revalidatePath("/finanzen");
    return { ok: true, message: `Rechnung ${invoice.nummer as string} wurde erstellt.` };
  } catch (e) {
    console.error("createManualInvoice failed", e);
    return { ok: false, message: "Die Rechnung konnte nicht erstellt werden. Bitte erneut versuchen." };
  }
}

export async function markInvoicePaid(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "edit");

    const [invoice] = await sql`
      update admin.invoice
      set status = 'BEZAHLT', paid_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null and status <> 'STORNIERT'
      returning id, placement_id`;
    if (!invoice) {
      return {
        ok: false,
        message: "Die Rechnung wurde nicht gefunden oder ist storniert.",
      };
    }

    if (invoice.placement_id) {
      await sql`
        update admin.placement
        set status = 'PAID', updated_at = now()
        where id = ${invoice.placement_id} and status <> 'CANCELLED'`;
    }

    await recordAudit({
      actorId: employee.id,
      action: "invoice.paid",
      entityType: "placement",
      entityId: id,
      metadata: {},
    });

    revalidatePath("/finanzen");
    revalidatePath(`/finanzen/${id}`);
    revalidatePath("/vermittlungen");
    return { ok: true, message: "Rechnung als bezahlt markiert." };
  } catch (e) {
    console.error("markInvoicePaid failed", e);
    return {
      ok: false,
      message: "Die Rechnung konnte nicht aktualisiert werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Mahnung protokollieren: reminder_count hoch, last_reminder_at setzen und
 * bei Fälligkeitsüberschreitung Status auf UEBERFAELLIG. Kein echter Versand —
 * das folgt über die Outbox.
 */
export async function sendReminder(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "edit");

    const [invoice] = await sql`
      update admin.invoice
      set reminder_count = reminder_count + 1,
          last_reminder_at = now(),
          status = case
            when status = 'OFFEN' and due_at is not null and due_at < now()
              then 'UEBERFAELLIG'
            else status
          end,
          updated_at = now()
      where id = ${id} and deleted_at is null
        and status in ('OFFEN', 'UEBERFAELLIG')
      returning id, reminder_count, status`;
    if (!invoice) {
      return {
        ok: false,
        message: "Für diese Rechnung ist keine Mahnung möglich.",
      };
    }

    await recordAudit({
      actorId: employee.id,
      action: "invoice.reminded",
      entityType: "placement",
      entityId: id,
      metadata: { reminderCount: invoice.reminder_count },
    });

    revalidatePath("/finanzen");
    revalidatePath(`/finanzen/${id}`);
    return {
      ok: true,
      message: `Mahnung protokolliert (${invoice.reminder_count as number}. Mahnung). E-Mail-Versand folgt über die Outbox.`,
    };
  } catch (e) {
    console.error("sendReminder failed", e);
    return {
      ok: false,
      message: "Die Mahnung konnte nicht protokolliert werden. Bitte erneut versuchen.",
    };
  }
}

export async function cancelInvoice(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("rewards", "edit");

    const [invoice] = await sql`
      update admin.invoice
      set status = 'STORNIERT', updated_at = now()
      where id = ${id} and deleted_at is null and status <> 'BEZAHLT'
      returning id`;
    if (!invoice) {
      return {
        ok: false,
        message: "Eine bereits bezahlte Rechnung kann nicht storniert werden.",
      };
    }

    await recordAudit({
      actorId: employee.id,
      action: "invoice.cancelled",
      entityType: "placement",
      entityId: id,
      metadata: {},
    });

    revalidatePath("/finanzen");
    revalidatePath(`/finanzen/${id}`);
    return { ok: true, message: "Rechnung storniert." };
  } catch (e) {
    console.error("cancelInvoice failed", e);
    return {
      ok: false,
      message: "Die Rechnung konnte nicht storniert werden. Bitte erneut versuchen.",
    };
  }
}
