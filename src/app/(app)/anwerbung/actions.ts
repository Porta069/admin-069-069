"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { renderVorlageEmail, substituteVars } from "@/lib/email-templates";
import { processOutbox } from "@/lib/mailer";
import { LEAD_STATUSES } from "./lead-defs";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const clean = (v: unknown, max = 300): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

export async function createLead(input: {
  name: string;
  ansprechpartner?: string;
  email?: string;
  phone?: string;
  ort?: string;
  website?: string;
  quelle?: string;
  notiz?: string;
  assigneeId?: string | null;
}): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "create");
    const name = clean(input.name, 200);
    if (!name) return { ok: false, message: "Bitte einen Firmennamen angeben." };
    const [lead] = await sql`
      insert into admin.company_lead
        (name, ansprechpartner, email, phone, ort, website, quelle, notiz,
         assignee_id, created_by)
      values (${name}, ${clean(input.ansprechpartner)}, ${clean(input.email)},
              ${clean(input.phone)}, ${clean(input.ort)}, ${clean(input.website)},
              ${clean(input.quelle)}, ${clean(input.notiz, 4000)},
              ${input.assigneeId || null}, ${employee.id})
      returning id`;
    await recordAudit({
      actorId: employee.id,
      action: "lead.created",
      entityType: "company_lead",
      entityId: lead.id as string,
      metadata: { name },
    });
    revalidatePath("/anwerbung");
    return { ok: true, message: `„${name}" wurde als Lead angelegt.` };
  } catch (e) {
    console.error("createLead failed", e);
    return { ok: false, message: "Der Lead konnte nicht angelegt werden." };
  }
}

export async function updateLeadStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
      return { ok: false, message: "Unbekannter Status." };
    }
    const rows = await sql`
      update admin.company_lead set status = ${status}, updated_at = now()
      where id = ${id} and deleted_at is null returning id`;
    if (rows.length === 0) return { ok: false, message: "Lead wurde nicht gefunden." };
    await recordAudit({
      actorId: employee.id,
      action: "lead.status_changed",
      entityType: "company_lead",
      entityId: id,
      metadata: { status },
    });
    revalidatePath("/anwerbung");
    return { ok: true, message: "Status aktualisiert." };
  } catch (e) {
    console.error("updateLeadStatus failed", e);
    return { ok: false, message: "Status konnte nicht geändert werden." };
  }
}

export async function archiveLead(id: string): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    const rows = await sql`
      update admin.company_lead set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null returning id`;
    if (rows.length === 0) return { ok: false, message: "Lead wurde nicht gefunden." };
    await recordAudit({
      actorId: employee.id,
      action: "lead.archived",
      entityType: "company_lead",
      entityId: id,
    });
    revalidatePath("/anwerbung");
    return { ok: true, message: "Lead archiviert." };
  } catch (e) {
    console.error("archiveLead failed", e);
    return { ok: false, message: "Lead konnte nicht archiviert werden." };
  }
}

/** Individuelle Anwerbungs-E-Mail an den Lead (gebrandet, sofort versendet). */
export async function sendeLeadEmail(
  id: string,
  betreff: string,
  nachricht: string,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("companies", "edit");
    const b = betreff.trim();
    const n = nachricht.trim();
    if (!b) return { ok: false, message: "Bitte einen Betreff angeben." };
    if (!n) return { ok: false, message: "Bitte einen Text angeben." };

    const [lead] = await sql`
      select id, name, ansprechpartner, email, status from admin.company_lead
      where id = ${id} and deleted_at is null limit 1`;
    if (!lead) return { ok: false, message: "Lead wurde nicht gefunden." };
    if (!lead.email)
      return { ok: false, message: "Für diesen Lead ist keine E-Mail-Adresse hinterlegt." };

    const heute = new Intl.DateTimeFormat("de-DE").format(new Date());
    const vars = {
      firma: (lead.name as string) ?? "",
      name: (lead.ansprechpartner as string) || (lead.name as string) || "",
      email: lead.email as string,
      datum: heute,
    };
    const { text, html } = renderVorlageEmail(
      { variante: "brief", titel: "", betreff: b, einleitung: n, schluss: "", hervorhebung: "" },
      vars,
    );
    const subject = substituteVars(b, vars);

    const [mail] = await sql`
      insert into admin.outbox_email
        (to_email, to_name, subject, body, html, kind, entity_type, entity_id, created_by)
      values (${lead.email as string}, ${(lead.ansprechpartner as string) || (lead.name as string)},
              ${subject}, ${text}, ${html}, 'SYSTEM', 'company_lead', ${id}, ${employee.id})
      returning id`;

    let versendet = false;
    let fehler: string | null = null;
    try {
      await processOutbox();
      const [nachher] = await sql`
        select status, error from admin.outbox_email where id = ${mail.id}`;
      versendet = nachher?.status === "SENT";
      if (nachher?.status === "FAILED") fehler = (nachher.error as string) ?? "unbekannt";
    } catch (e) {
      console.error("processOutbox (lead) fehlgeschlagen", e);
    }
    if (fehler) return { ok: false, message: `Versand fehlgeschlagen: ${fehler}` };

    // Erstkontakt vermerken: Status NEU → KONTAKTIERT, Zeitpunkt festhalten.
    await sql`
      update admin.company_lead
      set last_contacted_at = now(),
          status = case when status = 'NEU' then 'KONTAKTIERT' else status end,
          updated_at = now()
      where id = ${id}`;

    await recordAudit({
      actorId: employee.id,
      action: "lead.email_sent",
      entityType: "company_lead",
      entityId: id,
      metadata: { subject, to: lead.email, versendet },
    });
    revalidatePath("/anwerbung");
    return {
      ok: true,
      message: versendet
        ? `E-Mail „${subject}" wurde an ${lead.email} versendet.`
        : `E-Mail „${subject}" wurde eingereiht und wird in Kürze versendet.`,
    };
  } catch (e) {
    console.error("sendeLeadEmail failed", e);
    return { ok: false, message: "Die E-Mail konnte nicht versendet werden." };
  }
}
