"use server";

import { revalidatePath } from "next/cache";
import { requireEmployee, requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { queueEmail, processOutbox, mailerConfigured } from "@/lib/mailer";
import {
  DEFAULT_RESET_EMAIL,
  renderResetEmail,
  type ResetEmailConfig,
} from "@/lib/reset-email";
import {
  getResetEmailConfig,
  saveResetEmailConfig,
  resetResetEmailConfig,
} from "@/lib/reset-email-store";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/** Nur bekannte Felder übernehmen und auf Strings normalisieren. */
function bereinige(input: Partial<ResetEmailConfig>): ResetEmailConfig {
  const keys = Object.keys(DEFAULT_RESET_EMAIL) as (keyof ResetEmailConfig)[];
  const out = { ...DEFAULT_RESET_EMAIL };
  for (const k of keys) {
    const val = input[k];
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

export async function saveResetEmail(input: Partial<ResetEmailConfig>): Promise<Result> {
  try {
    const employee = await requirePermission("communication", "edit");
    const cfg = bereinige(input);
    if (!cfg.subject.trim()) return { ok: false, message: "Der Betreff darf nicht leer sein." };
    if (!cfg.buttonUrl.includes("{{reset_url}}")) {
      return {
        ok: false,
        message: "Der Button-Link muss die Variable {{reset_url}} enthalten (der eigentliche Reset-Link).",
      };
    }
    // Logo-Data-URIs können groß sein — Obergrenze zum Schutz von Zeile/Mail.
    if (cfg.logoUrl.length > 700_000) {
      return { ok: false, message: "Das Logo ist zu groß (max. ~0,5 MB). Bitte kleiner hochladen." };
    }
    await saveResetEmailConfig(cfg);
    await recordAudit({
      actorId: employee.id,
      action: "reset_email.updated",
      entityType: "setting",
      entityId: "reset_email",
    });
    revalidatePath("/belege/passwort-reset");
    return { ok: true };
  } catch (e) {
    console.error("saveResetEmail", e);
    return { ok: false, message: "Speichern fehlgeschlagen." };
  }
}

export async function resetToDefault(): Promise<Result> {
  try {
    const employee = await requirePermission("communication", "edit");
    await resetResetEmailConfig();
    await recordAudit({
      actorId: employee.id,
      action: "reset_email.reset_to_default",
      entityType: "setting",
      entityId: "reset_email",
    });
    revalidatePath("/belege/passwort-reset");
    return { ok: true };
  } catch (e) {
    console.error("resetToDefault", e);
    return { ok: false, message: "Zurücksetzen fehlgeschlagen." };
  }
}

/** Testversand der aktuell gespeicherten Vorlage an eine Adresse. */
export async function sendResetTest(toEmail: string): Promise<Result> {
  try {
    const employee = await requireEmployee("communication");
    const email = toEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: "Bitte eine gültige E-Mail-Adresse angeben." };
    }
    if (!mailerConfigured()) {
      return { ok: false, message: "E-Mail-Versand ist nicht konfiguriert (Brevo-Keys fehlen)." };
    }
    const cfg = await getResetEmailConfig();
    const rendered = renderResetEmail(cfg, {
      reset_url: "https://portajobs.de/passwort/neu?token=TEST-VORSCHAU",
      name: employee.name,
    });
    await queueEmail({
      toEmail: email,
      subject: `[Test] ${rendered.subject}`,
      body: rendered.text,
      html: rendered.html,
      kind: "SYSTEM",
      entityType: "reset_email_test",
    });
    await processOutbox(5);
    await recordAudit({
      actorId: employee.id,
      action: "reset_email.test_sent",
      entityType: "setting",
      entityId: "reset_email",
    });
    return { ok: true };
  } catch (e) {
    console.error("sendResetTest", e);
    return { ok: false, message: "Testversand fehlgeschlagen." };
  }
}
