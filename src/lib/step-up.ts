import "server-only";
import { getEmployee } from "./auth";
import { sql } from "./db";
import { verifyTotp } from "./security";

/**
 * Step-up-Authentifizierung: sicherheitskritische Aktionen (z. B. Ändern der
 * Bezahl-Variablen) verlangen zusätzlich den aktuellen 2FA-Code des angemeldeten
 * Mitarbeiters. Rein serverseitig — der Code wird nie im Klartext gespeichert.
 */
export async function verifyStepUp(
  code: string | undefined | null,
): Promise<{ ok: true; employeeId: string } | { ok: false; message: string }> {
  const emp = await getEmployee();
  if (!emp) return { ok: false, message: "Nicht angemeldet." };

  const clean = (code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) {
    return { ok: false, message: "Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben." };
  }

  const [row] = await sql`
    select totp_secret, totp_enabled from admin.employee
    where id = ${emp.id} and deleted_at is null limit 1`;
  if (!row?.totp_enabled || !row.totp_secret) {
    return {
      ok: false,
      message: "Für diese Aktion ist 2FA nötig. Bitte zuerst unter Konto → Sicherheit einrichten.",
    };
  }

  const ok = await verifyTotp(row.totp_secret as string, clean);
  if (!ok) return { ok: false, message: "Der 2FA-Code ist nicht korrekt." };
  return { ok: true, employeeId: emp.id };
}
