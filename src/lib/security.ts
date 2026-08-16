import "server-only";
import crypto from "crypto";
import * as otp from "otplib";
import { sql } from "./db";

/** TOTP (RFC 6238) — kompatibel mit Google Authenticator, Authy, 1Password … */

export function generateTotpSecret(): string {
  return otp.generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return otp.generateURI({
    secret,
    label: email,
    issuer: "Porta Werk Admin",
  });
}

export async function verifyTotp(
  secret: string,
  token: string,
): Promise<boolean> {
  try {
    const result = await otp.verify({
      secret,
      token: token.replace(/\s+/g, ""),
    });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

/**
 * Brute-Force-Schutz auf zwei Ebenen (Fenster: 15 Minuten):
 *  - pro E-Mail: ab 5 Fehlversuchen → Konto-Sperre (greift nur bei FALSCHEN
 *    Zugangsdaten; ein korrektes Passwort wird nie geblockt → kein Aussperr-DoS).
 *  - pro IP: ab 20 Fehlversuchen → harte Drosselung gegen Passwort-Spraying.
 */
const EMAIL_THRESHOLD = 5;
const IP_THRESHOLD = 20;
const LOCKOUT_WINDOW_MIN = 15;

async function fehlversuche(
  feld: "email" | "ip",
  wert: string,
): Promise<number> {
  if (!wert) return 0;
  const bedingung =
    feld === "email" ? sql`lower(email) = lower(${wert})` : sql`ip = ${wert}`;
  const [{ fails }] = await sql`
    select count(*)::int as fails from admin.login_event
    where ${bedingung}
      and success = false
      and created_at > now() - interval '${sql.unsafe(String(LOCKOUT_WINDOW_MIN))} minutes'`;
  return fails as number;
}

/** IP mit zu vielen Fehlversuchen → sofort blocken (schützt vor Spraying). */
export async function istIpGesperrt(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  return (await fehlversuche("ip", ip)) >= IP_THRESHOLD;
}

/** Konto mit zu vielen Fehlversuchen → nur bei falschen Zugangsdaten sperren. */
export async function istEmailGesperrt(email: string): Promise<boolean> {
  return (await fehlversuche("email", email)) >= EMAIL_THRESHOLD;
}

export function generateIcalToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function generatePassword(): string {
  return "PW-" + crypto.randomBytes(9).toString("base64url");
}
