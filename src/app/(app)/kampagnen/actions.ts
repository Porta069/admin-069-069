"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { queueEmail, renderTemplate } from "@/lib/mailer";
import { MAX_RECIPIENTS, type Audience, type AudienceTyp } from "./campaign-defs";

type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string };

export interface CampaignInput {
  name: string;
  subject: string;
  body: string;
  audience: Audience;
}

/** Eingehende (Client-)Audience defensiv auf bekannte Felder reduzieren. */
function sanitizeAudience(raw: Audience): Audience | null {
  const typs: AudienceTyp[] = ["kandidaten", "unternehmen", "partner"];
  if (!raw || !typs.includes(raw.typ)) return null;
  const clean = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 200) : null;
  if (raw.typ === "kandidaten") {
    return {
      typ: "kandidaten",
      bundesland: clean(raw.bundesland),
      beruf: clean(raw.beruf),
      verifiziert: Boolean(raw.verifiziert),
    };
  }
  if (raw.typ === "unternehmen") {
    return { typ: "unternehmen", ort: clean(raw.ort) };
  }
  return { typ: "partner" };
}

interface Recipient {
  email: string;
  name: string | null;
  vars: Record<string, string | null>;
  entityType: string;
  entityId: string;
}

/**
 * Empfänger serverseitig auflösen — dedupliziert nach E-Mail (case-insensitiv),
 * maximal MAX_RECIPIENTS + 1 Zeilen (zur Limit-Erkennung).
 */
async function resolveRecipients(a: Audience): Promise<Recipient[]> {
  const cap = MAX_RECIPIENTS + 1;

  if (a.typ === "kandidaten") {
    const rows = await sql`
      select distinct on (lower(email)) id, "firstName", "lastName", email
      from public."Application"
      where status <> 'ERASED' and email is not null and email <> ''
        ${a.bundesland ? sql`and "federalState" = ${a.bundesland}` : sql``}
        ${a.beruf ? sql`and profession = ${a.beruf}` : sql``}
        ${a.verifiziert ? sql`and verified = true` : sql``}
      order by lower(email), "createdAt" desc
      limit ${cap}`;
    return rows.map((r) => ({
      email: r.email as string,
      name: `${r.firstName as string} ${r.lastName as string}`.trim() || null,
      vars: {
        first_name: r.firstName as string,
        last_name: r.lastName as string,
      },
      entityType: "candidate",
      entityId: r.id as string,
    }));
  }

  if (a.typ === "unternehmen") {
    const rows = await sql`
      select distinct on (lower("kontaktEmail")) id, name, "kontaktEmail", "kontaktName"
      from public."Company"
      where "kontaktEmail" is not null and "kontaktEmail" <> ''
        ${a.ort ? sql`and ort = ${a.ort}` : sql``}
      order by lower("kontaktEmail"), "createdAt" desc
      limit ${cap}`;
    return rows.map((r) => ({
      email: r.kontaktEmail as string,
      name: (r.kontaktName as string | null) ?? (r.name as string),
      vars: {
        first_name: r.kontaktName as string | null,
        company: r.name as string,
      },
      entityType: "company",
      entityId: r.id as string,
    }));
  }

  const rows = await sql`
    select distinct on (lower(email)) id, name, email
    from public."Partner"
    where email is not null and email <> ''
    order by lower(email), "createdAt" desc
    limit ${cap}`;
  return rows.map((r) => ({
    email: r.email as string,
    name: (r.name as string | null) ?? null,
    vars: { first_name: r.name as string | null },
    entityType: "partner",
    entityId: r.id as string,
  }));
}

/** Live-Empfängerzahl für das Erstellen-Formular. */
export async function countRecipients(
  audience: Audience,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  try {
    await requirePermission("communication", "create");
    const a = sanitizeAudience(audience);
    if (!a) return { ok: false, message: "Bitte eine Zielgruppe wählen." };

    let count = 0;
    if (a.typ === "kandidaten") {
      const [row] = await sql`
        select count(distinct lower(email))::int as count
        from public."Application"
        where status <> 'ERASED' and email is not null and email <> ''
          ${a.bundesland ? sql`and "federalState" = ${a.bundesland}` : sql``}
          ${a.beruf ? sql`and profession = ${a.beruf}` : sql``}
          ${a.verifiziert ? sql`and verified = true` : sql``}`;
      count = row.count as number;
    } else if (a.typ === "unternehmen") {
      const [row] = await sql`
        select count(distinct lower("kontaktEmail"))::int as count
        from public."Company"
        where "kontaktEmail" is not null and "kontaktEmail" <> ''
          ${a.ort ? sql`and ort = ${a.ort}` : sql``}`;
      count = row.count as number;
    } else {
      const [row] = await sql`
        select count(distinct lower(email))::int as count
        from public."Partner"
        where email is not null and email <> ''`;
      count = row.count as number;
    }
    return { ok: true, count };
  } catch (e) {
    console.error("countRecipients failed", e);
    return {
      ok: false,
      message: "Die Empfänger konnten nicht gezählt werden. Bitte erneut versuchen.",
    };
  }
}

/** Kampagne als Entwurf speichern (kein Versand, keine Outbox-Zeilen). */
export async function saveDraft(input: CampaignInput): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "create");

    const name = input.name?.trim().slice(0, 200);
    if (!name) return { ok: false, message: "Bitte einen internen Namen angeben." };
    const audience = sanitizeAudience(input.audience);
    if (!audience) return { ok: false, message: "Bitte eine Zielgruppe wählen." };

    const subject = (input.subject ?? "").trim().slice(0, 500);
    const body = (input.body ?? "").trim().slice(0, 20000);

    // Empfängerzahl informativ mitspeichern (wird beim Versand neu aufgelöst).
    const counted = await countRecipients(audience);
    const recipientCount = counted.ok ? counted.count : 0;

    const [campaign] = await sql`
      insert into admin.campaign
        (name, subject, body, audience, status, created_by, recipient_count, sent_count)
      values
        (${name}, ${subject}, ${body}, ${sql.json(audience as never)},
         'DRAFT', ${employee.id}, ${recipientCount}, 0)
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "campaign.created",
      entityType: "campaign",
      entityId: campaign.id as string,
      metadata: { name, audience, recipientCount, status: "DRAFT" },
    });

    revalidatePath("/kampagnen");
    return {
      ok: true,
      id: campaign.id as string,
      message: "Kampagne wurde als Entwurf gespeichert.",
    };
  } catch (e) {
    console.error("saveDraft failed", e);
    return {
      ok: false,
      message: "Der Entwurf konnte nicht gespeichert werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Kampagne in Versand geben: Empfänger auflösen, pro Empfänger eine
 * personalisierte PENDING-Outbox-Zeile anlegen, Status SENDING setzen.
 * Der Sync-Runner (processOutbox) versendet, sobald der Provider verbunden ist.
 */
export async function launchCampaign(input: CampaignInput): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "create");

    const name = input.name?.trim().slice(0, 200);
    const subject = input.subject?.trim().slice(0, 500);
    const body = input.body?.trim().slice(0, 20000);
    if (!name) return { ok: false, message: "Bitte einen internen Namen angeben." };
    if (!subject || !body) {
      return { ok: false, message: "Bitte Betreff und Inhalt ausfüllen." };
    }
    const audience = sanitizeAudience(input.audience);
    if (!audience) return { ok: false, message: "Bitte eine Zielgruppe wählen." };

    const recipients = await resolveRecipients(audience);
    if (recipients.length === 0) {
      return {
        ok: false,
        message: "Für diese Zielgruppe wurden keine Empfänger mit E-Mail-Adresse gefunden.",
      };
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return {
        ok: false,
        message: `Maximal ${MAX_RECIPIENTS} Empfänger pro Kampagne — bitte die Zielgruppe weiter eingrenzen.`,
      };
    }

    const [campaign] = await sql`
      insert into admin.campaign
        (name, subject, body, audience, status, created_by, recipient_count, sent_count)
      values
        (${name}, ${subject}, ${body}, ${sql.json(audience as never)},
         'SENDING', ${employee.id}, ${recipients.length}, 0)
      returning id`;
    const campaignId = campaign.id as string;

    // Personalisierte Mails in die Outbox stellen (in kleinen Parallel-Blöcken).
    const CHUNK = 25;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      await Promise.all(
        recipients.slice(i, i + CHUNK).map((r) =>
          queueEmail({
            toEmail: r.email,
            toName: r.name,
            subject: renderTemplate(subject, r.vars),
            body: renderTemplate(body, r.vars),
            kind: "CAMPAIGN",
            campaignId,
            entityType: r.entityType,
            entityId: r.entityId,
          }),
        ),
      );
    }

    await recordAudit({
      actorId: employee.id,
      action: "campaign.launched",
      entityType: "campaign",
      entityId: campaignId,
      metadata: { name, audience, recipientCount: recipients.length },
    });

    revalidatePath("/kampagnen");
    return {
      ok: true,
      id: campaignId,
      message: `Kampagne mit ${recipients.length} Empfängern in Versand gegeben.`,
    };
  } catch (e) {
    console.error("launchCampaign failed", e);
    return {
      ok: false,
      message: "Die Kampagne konnte nicht in Versand gegeben werden. Bitte erneut versuchen.",
    };
  }
}

/**
 * Kampagne abbrechen (nur DRAFT/SCHEDULED/SENDING): Status CANCELLED,
 * alle wartenden Outbox-Zeilen werden übersprungen.
 */
export async function cancelCampaign(id: string): Promise<ActionResult> {
  try {
    // Wer versenden darf, darf den Versand auch stoppen.
    const employee = await requirePermission("communication", "create");

    const rows = await sql`
      update admin.campaign
      set status = 'CANCELLED', updated_at = now()
      where id = ${id}
        and deleted_at is null
        and status in ('DRAFT', 'SCHEDULED', 'SENDING')
      returning id`;
    if (rows.length === 0) {
      return {
        ok: false,
        message: "Die Kampagne kann nicht mehr abgebrochen werden.",
      };
    }

    const skipped = await sql`
      update admin.outbox_email
      set status = 'SKIPPED'
      where campaign_id = ${id} and status = 'PENDING'
      returning id`;

    await recordAudit({
      actorId: employee.id,
      action: "campaign.cancelled",
      entityType: "campaign",
      entityId: id,
      metadata: { skippedEmails: skipped.length },
    });

    revalidatePath("/kampagnen");
    revalidatePath(`/kampagnen/${id}`);
    return { ok: true, message: "Kampagne wurde abgebrochen." };
  } catch (e) {
    console.error("cancelCampaign failed", e);
    return {
      ok: false,
      message: "Die Kampagne konnte nicht abgebrochen werden. Bitte erneut versuchen.",
    };
  }
}
