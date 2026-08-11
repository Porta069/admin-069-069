"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  ACTION_TYPES,
  TRIGGERS,
  type AutomationActionType,
  type AutomationTrigger,
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
    if (!TRIGGERS.includes(input.trigger as AutomationTrigger)) {
      return { ok: false, message: "Bitte einen gültigen Trigger wählen." };
    }
    if (!ACTION_TYPES.includes(input.actionType as AutomationActionType)) {
      return { ok: false, message: "Bitte einen gültigen Aktions-Typ wählen." };
    }

    const [row] = await sql`
      insert into admin.automation (name, trigger, conditions, actions, enabled)
      values (
        ${name},
        ${input.trigger},
        ${sql.json({})},
        ${sql.json([{ type: input.actionType }])},
        false
      )
      returning id`;

    await recordAudit({
      actorId: actor.id,
      action: "automation.created",
      entityType: "automation",
      entityId: row.id as string,
      metadata: { name, trigger: input.trigger, actionType: input.actionType },
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
