import "server-only";
import { sql } from "./db";

/**
 * Provider-agnostische E-Mail-Schicht mit persistenter Outbox.
 *
 * Provider: Brevo (BREVO_API_KEY) hat Vorrang, sonst Resend (RESEND_API_KEY);
 * beide brauchen einen verifizierten Absender in EMAIL_FROM. Ohne Provider
 * bleiben Mails als PENDING in admin.outbox_email liegen und werden automatisch
 * versendet, sobald ein Key hinterlegt ist — kein Datenverlust, kein stiller Fehler.
 */

export function mailerConfigured(): boolean {
  return Boolean(
    (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) &&
      process.env.EMAIL_FROM,
  );
}

/** EMAIL_FROM als „Name <mail@…>" oder reine Adresse interpretieren. */
function absenderVon(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1].trim() || undefined };
  return { email: from.trim(), name: process.env.EMAIL_FROM_NAME || undefined };
}

/**
 * Absender je nach Mail-Art wählen. Kampagnen/Newsletter gehen von
 * EMAIL_FROM_CAMPAIGN (z. B. info@…), alle anderen (System, Automatik,
 * Bestätigungscodes) vom Standard-Absender EMAIL_FROM (z. B. verify@…).
 * Ist EMAIL_FROM_CAMPAIGN nicht gesetzt, nutzen alle EMAIL_FROM.
 */
function absenderFuer(kind: string | null | undefined): string {
  if (kind === "CAMPAIGN" && process.env.EMAIL_FROM_CAMPAIGN) {
    return process.env.EMAIL_FROM_CAMPAIGN;
  }
  return process.env.EMAIL_FROM as string;
}

export interface QueueEmailInput {
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  kind?: "CAMPAIGN" | "SYSTEM" | "AUTOMATION";
  campaignId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export async function queueEmail(input: QueueEmailInput): Promise<void> {
  await sql`
    insert into admin.outbox_email
      (campaign_id, to_email, to_name, subject, body, kind, entity_type, entity_id)
    values
      (${input.campaignId ?? null}, ${input.toEmail}, ${input.toName ?? null},
       ${input.subject}, ${input.body}, ${input.kind ?? "SYSTEM"},
       ${input.entityType ?? null}, ${input.entityId ?? null})`;
}

/** Ersetzt {first_name} {last_name} {company} {job_title} in Vorlagen. */
export function renderTemplate(
  text: string,
  vars: Record<string, string | null | undefined>,
): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? match : value;
  });
}

async function sendViaBrevo(
  to: string,
  subject: string,
  body: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY as string,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: absenderVon(from),
      to: [{ email: to }],
      subject,
      textContent: body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Brevo ${res.status}: ${detail.slice(0, 200)}` };
  }
  return { ok: true };
}

async function sendViaResend(
  to: string,
  subject: string,
  body: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
  }
  return { ok: true };
}

/**
 * Versendet fällige Outbox-Mails (max. `limit` pro Lauf). No-op ohne Provider.
 * Wird vom Sync-Runner aufgerufen.
 */
export async function processOutbox(limit = 25): Promise<number> {
  if (!mailerConfigured()) return 0;

  const pending = await sql`
    select id, to_email, subject, body, campaign_id, kind
    from admin.outbox_email
    where status = 'PENDING'
    order by created_at
    limit ${limit}`;

  const versende = process.env.BREVO_API_KEY ? sendViaBrevo : sendViaResend;

  let sent = 0;
  for (const mail of pending) {
    const result = await versende(
      mail.to_email as string,
      mail.subject as string,
      mail.body as string,
      absenderFuer(mail.kind as string | null),
    ).catch((e: Error) => ({ ok: false as const, error: e.message }));

    if (result.ok) {
      await sql`
        update admin.outbox_email
        set status = 'SENT', sent_at = now() where id = ${mail.id}`;
      if (mail.campaign_id) {
        await sql`
          update admin.campaign set sent_count = sent_count + 1,
            updated_at = now() where id = ${mail.campaign_id}`;
      }
      sent++;
    } else {
      await sql`
        update admin.outbox_email
        set status = 'FAILED', error = ${result.error ?? "unbekannt"}
        where id = ${mail.id}`;
    }
  }

  // Kampagnen abschließen, deren Outbox leer ist
  await sql`
    update admin.campaign c set status = 'SENT', updated_at = now()
    where c.status = 'SENDING'
      and not exists (
        select 1 from admin.outbox_email o
        where o.campaign_id = c.id and o.status = 'PENDING')`;

  return sent;
}
