"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Vorlagentext einer Ereignis-Benachrichtigung speichern. */
export async function saveVorlage(
  event: string,
  payload: {
    titel: string;
    betreff: string;
    einleitung: string;
    schluss: string;
    hervorhebung: string;
    variante: string;
    enabled: boolean;
  },
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "edit");
    if (!payload.titel?.trim()) {
      return { ok: false, message: "Der Titel darf nicht leer sein." };
    }
    const variante = payload.variante === "zentriert" ? "zentriert" : "brief";
    const [row] = await sql`
      update admin.benachrichtigung_vorlage set
        titel = ${payload.titel.trim()},
        betreff = ${payload.betreff?.trim() || null},
        einleitung = ${payload.einleitung ?? null},
        schluss = ${payload.schluss ?? null},
        hervorhebung = ${payload.hervorhebung?.trim() || null},
        variante = ${variante},
        enabled = ${payload.enabled},
        updated_by = ${employee.id},
        updated_at = now()
      where event = ${event}
      returning event`;
    if (!row) return { ok: false, message: "Vorlage nicht gefunden." };

    await recordAudit({
      actorId: employee.id,
      action: "vorlage.updated",
      entityType: "template",
      entityId: event,
      metadata: { enabled: payload.enabled },
    });
    revalidatePath("/belege");
    revalidatePath(`/belege/${event}`);
    return { ok: true, message: "Vorlage gespeichert." };
  } catch (e) {
    console.error("saveVorlage failed", e);
    return { ok: false, message: "Die Vorlage konnte nicht gespeichert werden." };
  }
}

/**
 * Globaler Master-Schalter für den autonomen Ereignis-Versand. Standard AUS —
 * solange dieser aus ist, wird NICHTS automatisch versendet, egal welche Vorlage
 * aktiviert ist. Schützt vor Doppelversand zu Plattform-Mails.
 */
export async function setAutonomerVersand(aktiv: boolean): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "edit");
    await sql`
      insert into admin.setting (key, value)
      values ('autonomer_versand', ${sql.json({ aktiv })})
      on conflict (key) do update set value = ${sql.json({ aktiv })}`;
    await recordAudit({
      actorId: employee.id,
      action: "autonomer_versand.toggled",
      entityType: "setting",
      entityId: "autonomer_versand",
      metadata: { aktiv },
    });
    revalidatePath("/belege");
    return {
      ok: true,
      message: aktiv
        ? "Autonomer Versand aktiviert — aktivierte Vorlagen werden jetzt bei ihrem Ereignis automatisch versendet."
        : "Autonomer Versand deaktiviert — es wird nichts mehr automatisch versendet.",
    };
  } catch (e) {
    console.error("setAutonomerVersand failed", e);
    return { ok: false, message: "Aktion fehlgeschlagen." };
  }
}

/** Vorlage aktivieren/deaktivieren (steuert den späteren autonomen Versand). */
export async function toggleVorlage(
  event: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const employee = await requirePermission("communication", "edit");
    await sql`
      update admin.benachrichtigung_vorlage
      set enabled = ${enabled}, updated_by = ${employee.id}, updated_at = now()
      where event = ${event}`;
    await recordAudit({
      actorId: employee.id,
      action: "vorlage.toggled",
      entityType: "template",
      entityId: event,
      metadata: { enabled },
    });
    revalidatePath("/belege");
    return { ok: true, message: enabled ? "Vorlage aktiviert." : "Vorlage deaktiviert." };
  } catch (e) {
    console.error("toggleVorlage failed", e);
    return { ok: false, message: "Aktion fehlgeschlagen." };
  }
}
