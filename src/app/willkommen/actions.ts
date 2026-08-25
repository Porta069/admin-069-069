"use server";

import { redirect } from "next/navigation";
import { getEmployee, rolleBrauchtZweiFaktor } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; message: string };

/**
 * Onboarding abschließen. 2FA ist für alle Rollen Pflicht — ohne aktives 2FA
 * kann der Assistent nicht beendet werden (die Zwei-Faktor-Einrichtung ist der
 * Kern des Erstlogins). Handy-Benachrichtigungen sind optional.
 */
export async function completeOnboardingAction(): Promise<Result> {
  const employee = await getEmployee();
  if (!employee) return { ok: false, message: "Nicht angemeldet." };

  const [row] = await sql`
    select totp_enabled from admin.employee where id = ${employee.id}`;
  const zweiFaktorAktiv = Boolean(row?.totp_enabled);
  if (rolleBrauchtZweiFaktor(employee.roleId) && !zweiFaktorAktiv) {
    return {
      ok: false,
      message: "Bitte zuerst die Zwei-Faktor-Authentifizierung einrichten.",
    };
  }

  await sql`
    update admin.employee set onboarded_at = now(), updated_at = now()
    where id = ${employee.id} and onboarded_at is null`;
  await recordAudit({
    actorId: employee.id,
    action: "employee.onboarded",
    entityType: "employee",
    entityId: employee.id,
  });
  return { ok: true };
}

/** Nach Abschluss ins Dashboard leiten (eigene Action → sauberer Redirect). */
export async function finishOnboardingAndGoHome(): Promise<void> {
  const res = await completeOnboardingAction();
  if (res.ok) redirect("/");
}
