"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const KNOWN_MESSAGES = new Set([
  "Nicht angemeldet.",
  "Keine Berechtigung für diese Aktion.",
]);

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && KNOWN_MESSAGES.has(e.message)) return e.message;
  return fallback;
}

export async function revokeSession(
  tokenHash: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    // Fremd-Sitzungen zwangsweise beenden ist eine Konto-Verwaltungs-Aktion,
    // KEINE reine Lese-Operation → erfordert employees:manage (nicht audit:view).
    const actor = await requirePermission("employees", "manage");

    // Die eigene aktuelle Sitzung darf hier nicht beendet werden.
    const cookieStore = await cookies();
    const ownToken = cookieStore.get("pw_session")?.value;
    if (
      ownToken &&
      crypto.createHash("sha256").update(ownToken).digest("hex") === tokenHash
    ) {
      return {
        ok: false,
        message:
          "Die eigene Sitzung kann hier nicht beendet werden — bitte normal abmelden.",
      };
    }

    const [session] = await sql`
      select token_hash, employee_id from admin.session
      where token_hash = ${tokenHash} and revoked_at is null limit 1`;
    if (!session) {
      return {
        ok: false,
        message: "Sitzung wurde nicht gefunden oder ist bereits beendet.",
      };
    }

    await sql`
      update admin.session set revoked_at = now()
      where token_hash = ${tokenHash} and revoked_at is null`;
    await recordAudit({
      actorId: actor.id,
      action: "session.revoked",
      entityType: "employee",
      entityId: session.employee_id as string,
      metadata: { tokenHashPrefix: tokenHash.slice(0, 8) },
    });

    revalidatePath("/audit");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      message: errorMessage(e, "Sitzung konnte nicht beendet werden."),
    };
  }
}
