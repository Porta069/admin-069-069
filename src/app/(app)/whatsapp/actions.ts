"use server";

import { revalidatePath } from "next/cache";
import { getEmployee, requirePermission, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isValidTrigger, MAX_DELAY_HOURS } from "./constants";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

type Result = { ok: true } | { ok: false; message: string };

/** Verzögerung normalisieren (ganze Stunden, 0…30 Tage). */
function normalizeDelay(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const hours = Math.round(value);
  if (hours < 0 || hours > MAX_DELAY_HOURS) return null;
  return hours;
}

/**
 * Prüft, dass entweder eine Nachricht ODER eine gültige Vorlage vorliegt,
 * und gibt die aufgelöste Vorlagen-ID zurück (oder null bei Freitext).
 */
async function resolveTemplate(
  templateId: string | null | undefined,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  if (!templateId) {
    return { ok: false, message: "Die gewählte Vorlage wurde nicht gefunden." };
  }
  const rows = await sql`
    select id from admin.template
    where id = ${templateId} and deleted_at is null`;
  if (rows.length === 0) {
    return { ok: false, message: "Die gewählte Vorlage wurde nicht gefunden." };
  }
  return { ok: true, templateId };
}

export interface RuleInput {
  name: string;
  trigger: string;
  verzoegerungStunden: number;
  /** Entweder Freitext-Nachricht … */
  nachricht?: string | null;
  /** … oder eine Vorlage übernehmen. */
  templateId?: string | null;
}

export async function createRule(input: RuleInput): Promise<Result> {
  try {
    const actor = await requirePermission("communication", "create");

    const name = input.name.trim();
    if (name.length < 3) {
      return {
        ok: false,
        message: "Bitte einen Namen mit mindestens 3 Zeichen angeben.",
      };
    }
    if (!isValidTrigger(input.trigger)) {
      return { ok: false, message: "Bitte einen gültigen Auslöser wählen." };
    }
    const delay = normalizeDelay(input.verzoegerungStunden);
    if (delay === null) {
      return {
        ok: false,
        message: "Bitte eine gültige Verzögerung angeben (0 bis 30 Tage).",
      };
    }

    const useTemplate = Boolean(input.templateId);
    const nachricht = (input.nachricht ?? "").trim();
    if (!useTemplate && nachricht.length < 3) {
      return {
        ok: false,
        message: "Bitte eine Nachricht schreiben oder eine Vorlage wählen.",
      };
    }

    let templateId: string | null = null;
    if (useTemplate) {
      const resolved = await resolveTemplate(input.templateId);
      if (!resolved.ok) return resolved;
      templateId = resolved.templateId;
    }

    const [row] = await sql`
      insert into admin.whatsapp_rule
        (name, trigger, verzoegerung_stunden, template_id, nachricht, enabled, created_by)
      values (
        ${name},
        ${input.trigger},
        ${delay},
        ${templateId},
        ${useTemplate ? null : nachricht},
        false,
        ${actor.id}
      )
      returning id`;

    await recordAudit({
      actorId: actor.id,
      action: "whatsapp_rule.created",
      entityType: "whatsapp_rule",
      entityId: row.id as string,
      metadata: {
        name,
        trigger: input.trigger,
        verzoegerungStunden: delay,
        templateId,
      },
    });

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Regel konnte nicht angelegt werden."),
    };
  }
}

export interface RuleUpdateInput {
  id: string;
  name?: string;
  trigger?: string;
  verzoegerungStunden?: number;
  nachricht?: string | null;
  templateId?: string | null;
  enabled?: boolean;
}

/**
 * Bearbeitet eine Regel — deckt sowohl das reine Umschalten von `enabled`
 * (Status-Toggle) als auch das Bearbeiten der Inhalte ab. Nur übergebene
 * Felder werden verändert.
 */
export async function updateRule(input: RuleUpdateInput): Promise<Result> {
  try {
    const actor = await requirePermission("communication", "edit");

    const [existing] = await sql`
      select id, name, trigger, verzoegerung_stunden, template_id, nachricht, enabled
      from admin.whatsapp_rule
      where id = ${input.id} and deleted_at is null`;
    if (!existing) {
      return { ok: false, message: "Regel wurde nicht gefunden." };
    }

    // Reines Status-Umschalten (Toggle-Komponente).
    const onlyEnabled =
      input.enabled !== undefined &&
      input.name === undefined &&
      input.trigger === undefined &&
      input.verzoegerungStunden === undefined &&
      input.nachricht === undefined &&
      input.templateId === undefined;

    if (onlyEnabled) {
      await sql`
        update admin.whatsapp_rule
        set enabled = ${input.enabled!}, updated_at = now()
        where id = ${input.id} and deleted_at is null`;
      await recordAudit({
        actorId: actor.id,
        action: "whatsapp_rule.toggled",
        entityType: "whatsapp_rule",
        entityId: input.id,
        metadata: { enabled: input.enabled, name: existing.name },
      });
      revalidatePath("/whatsapp");
      return { ok: true };
    }

    // Vollständige Bearbeitung — Felder validieren und zusammenführen.
    const name = (input.name ?? (existing.name as string)).trim();
    if (name.length < 3) {
      return {
        ok: false,
        message: "Bitte einen Namen mit mindestens 3 Zeichen angeben.",
      };
    }

    const trigger = input.trigger ?? (existing.trigger as string);
    if (!isValidTrigger(trigger)) {
      return { ok: false, message: "Bitte einen gültigen Auslöser wählen." };
    }

    const delay = normalizeDelay(
      input.verzoegerungStunden ?? (existing.verzoegerung_stunden as number),
    );
    if (delay === null) {
      return {
        ok: false,
        message: "Bitte eine gültige Verzögerung angeben (0 bis 30 Tage).",
      };
    }

    // Vorlage vs. Freitext: templateId hat Vorrang, wenn gesetzt.
    const useTemplate = Boolean(input.templateId);
    let templateId: string | null = null;
    let nachricht: string | null = null;
    if (useTemplate) {
      const resolved = await resolveTemplate(input.templateId);
      if (!resolved.ok) return resolved;
      templateId = resolved.templateId;
    } else {
      const text = (
        input.nachricht ??
        (existing.nachricht as string | null) ??
        ""
      ).trim();
      if (text.length < 3) {
        return {
          ok: false,
          message: "Bitte eine Nachricht schreiben oder eine Vorlage wählen.",
        };
      }
      nachricht = text;
    }

    const enabled =
      input.enabled ?? (existing.enabled as boolean);

    await sql`
      update admin.whatsapp_rule
      set name = ${name},
          trigger = ${trigger},
          verzoegerung_stunden = ${delay},
          template_id = ${templateId},
          nachricht = ${nachricht},
          enabled = ${enabled},
          updated_at = now()
      where id = ${input.id} and deleted_at is null`;

    await recordAudit({
      actorId: actor.id,
      action: "whatsapp_rule.updated",
      entityType: "whatsapp_rule",
      entityId: input.id,
      metadata: { name, trigger, verzoegerungStunden: delay, templateId },
    });

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Regel konnte nicht gespeichert werden."),
    };
  }
}

export async function deleteRule(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("communication", "edit");

    const updated = await sql`
      update admin.whatsapp_rule
      set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null
      returning id, name`;
    if (updated.length === 0) {
      return { ok: false, message: "Regel wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: actor.id,
      action: "whatsapp_rule.deleted",
      entityType: "whatsapp_rule",
      entityId: id,
      metadata: { name: updated[0].name },
    });

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Regel konnte nicht gelöscht werden."),
    };
  }
}

/**
 * Master-Schalter „WhatsApp aktivieren" — schreibt admin.setting `whatsapp`.
 * Berechtigung: communication:edit bzw. settings:edit, Fallback
 * communication:manage.
 */
export async function setWhatsappEnabled(aktiviert: boolean): Promise<Result> {
  try {
    const employee = await getEmployee();
    if (!employee) throw new Error("Nicht angemeldet.");
    const allowed =
      can(employee, "communication", "edit") ||
      can(employee, "settings", "edit") ||
      can(employee, "communication", "manage");
    if (!allowed) throw new Error("Keine Berechtigung für diese Aktion.");

    await sql`
      insert into admin.setting (key, value)
      values ('whatsapp', ${sql.json({ aktiviert })})
      on conflict (key) do update set value = excluded.value`;

    await recordAudit({
      actorId: employee.id,
      action: "whatsapp.setting_changed",
      entityType: "setting",
      entityId: "whatsapp",
      metadata: { aktiviert },
    });

    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Einstellung konnte nicht gespeichert werden."),
    };
  }
}
