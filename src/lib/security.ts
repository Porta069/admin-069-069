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
    issuer: "PORTAWERK Admin",
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
 * Brute-Force-Schutz: Nach 5 Fehlversuchen für eine E-Mail innerhalb von
 * 15 Minuten wird der Login temporär gesperrt.
 */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MIN = 15;

export async function isLockedOut(email: string): Promise<boolean> {
  const [{ fails }] = await sql`
    select count(*)::int as fails from admin.login_event
    where lower(email) = lower(${email})
      and success = false
      and created_at > now() - interval '${sql.unsafe(String(LOCKOUT_WINDOW_MIN))} minutes'`;
  return (fails as number) >= LOCKOUT_THRESHOLD;
}

export function generateIcalToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function generatePassword(): string {
  return "PW-" + crypto.randomBytes(9).toString("base64url");
}
