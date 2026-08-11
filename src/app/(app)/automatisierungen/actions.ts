"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  isSupportedTrigger,
  TRIGGER_ACTIONS,
  type AutomationActionType,
} from "./_components/constants";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

export async function createAutomation(input: {
  name: string;
  trigger: string;
  actionType: string;
  templateId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("automations", "create");

    const name = input.name.trim();
    if (name.length < 3) {
      return {
        ok: false,
        message: "Bitte einen Namen mit mindestens 3 Zeichen angeben.",
      };
    }
    if (!isSupportedTrigger(input.trigger)) {
      return { ok: false, message: "Bitte einen gültigen Trigger wählen." };
    }
    const allowedActions = TRIGGER_ACTIONS[input.trigger];
    if (!allowedActions.includes(input.actionType as AutomationActionType)) {
      return {
        ok: false,
        message: "Diese Aktion ist für den gewählten Trigger nicht verfügbar.",
      };
    }

    let templateId: string | null = null;
    if (input.actionType === "SEND_TEMPLATE") {
      if (!input.templateId) {
        return { ok: false, message: "Bitte eine Vorlage wählen." };
      }
      const templates = await sql`
        select id from admin.template
        where id = ${input.templateId} and deleted_at is null`;
      if (templates.length === 0) {
        return {
          ok: false,
          message: "Die gewählte Vorlage wurde nicht gefunden.",
        };
      }
      templateId = input.templateId;
    }

    const action: { type: string; templateId?: string } = {
      type: input.actionType,
    };
    if (templateId) action.templateId = templateId;

    const [row] = await sql`
      insert into admin.automation (name, trigger, conditions, actions, enabled)
      values (
        ${name},
        ${input.trigger},
        ${sql.json({})},
        ${sql.json([action])},
        false
      )
      returning id`;

    await recordAudit({
      actorId: actor.id,
      action: "automation.created",
      entityType: "automation",
      entityId: row.id as string,
      metadata: {
        name,
        trigger: input.trigger,
        actionType: input.actionType,
        templateId,
      },
    });

    revalidatePath("/automatisierungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Automation konnte nicht angelegt werden."),
    };
  }
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const actor = await requirePermission("automations", "edit");

    const updated = await sql`
      update admin.automation set enabled = ${enabled}
      where id = ${id} and deleted_at is null
      returning id, name`;
    if (updated.length === 0) {
      return { ok: false, message: "Automation wurde nicht gefunden." };
    }

    await recordAudit({
      actorId: actor.id,
      action: "automation.toggled",
      entityType: "automation",
      entityId: id,
      metadata: { enabled, name: updated[0].name },
    });

    revalidatePath("/automatisierungen");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Status konnte nicht geändert werden."),
    };
  }
}
