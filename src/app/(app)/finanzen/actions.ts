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

    // Nummer inline mit nextval → atomar in einem Statement (keine Lücken-Logik nötig).
    const [invoice] = await sql`
      insert into admin.invoice (
        nummer, placement_id, company_id, company_name,
        base_fee_cents, commission_cents, total_cents, status, issued_at,
        due_at, created_by
      ) values (
        'RE-' || extract(year from (now() at time zone 'Europe/Berlin'))::int
          || '-' || nextval('admin.invoice_seq'),
        ${placementId}, ${placement.company_id}, ${placement.company_name},
        ${baseFee}, ${commission}, ${total}, 'OFFEN', now(),
        now() + interval '14 days', ${employee.id}
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
