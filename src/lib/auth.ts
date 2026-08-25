import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import crypto from "crypto";
import { sql } from "./db";
import {
  hasPermission,
  type PermissionAction,
  type PermissionMap,
  type PermissionModule,
} from "./permissions";
import { istIpGebannt, aktuelleClientIp } from "./firewall-server";

const SESSION_COOKIE = "pw_session";
// Rollierendes 24-Stunden-Fenster: Bei jeder Aktivität wird die Sitzung wieder
// auf 24 h verlängert. Man bleibt also eingeloggt, solange man das Dashboard
// mindestens alle 24 h nutzt — beendet wird nur durch aktives Ausloggen oder
// 24 h Inaktivität. Der Cookie ist ein langlebiger Container; das eigentliche
// Gate ist admin.session.expires_at in der DB (jederzeit widerrufbar).
const SESSION_TTL_HOURS = 24;
const SESSION_COOKIE_DAYS = 30;

// scrypt-Kostenparameter (aktuell). N wird im Hash gespeichert, ältere Hashes
// bleiben verifizierbar und werden beim nächsten Login opportunistisch angehoben.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 96 * 1024 * 1024;

/**
 * 2FA ist für JEDES Mitarbeiterkonto verpflichtend. Nicht eingerichtete Konten
 * werden beim Login zur Selbst-Einrichtung (QR + Code) geführt und danach auf
 * Konto → Sicherheit geleitet, bis 2FA aktiv ist. Kein Konto wird ausgesperrt —
 * die Einrichtung erfolgt eigenständig. (Der Parameter bleibt erhalten, falls
 * künftig einzelne Rollen ausgenommen werden sollen.)
 */
export function rolleBrauchtZweiFaktor(_roleId: string): boolean {
  return true;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  /** Hierarchie-Level der Rolle (Master=100, Manager=80 …) für Escalation-Checks. */
  roleLevel: number;
  /** Effektive Rechte: individuelle Overrides ODER — wenn keine — die Rolle. */
  permissions: PermissionMap;
  /** true, wenn dieses Konto individuell angepasste Rechte hat (nicht Template). */
  hasCustomPermissions: boolean;
  avatarColor: string;
  /** Öffentliche Profilbild-URL oder null. */
  avatarUrl: string | null;
  team: string | null;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  /** null = Erstlogin-Assistent (2FA + Push) noch nicht durchlaufen. */
  onboardedAt: Date | null;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  // Format: scrypt:N:r:p:salthex:hashhex
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, expected] = parts;
  const derived = crypto
    .scryptSync(password, salt, expected.length / 2, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_MAXMEM,
    })
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    })
    .toString("hex");
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
}

/** Hash mit veralteten Kostenparametern → beim nächsten Login neu hashen. */
function needsRehash(stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < SCRYPT_N;
}

/**
 * Fester Dummy-Hash, gegen den bei unbekanntem/inaktivem Konto geprüft wird,
 * damit die Antwortzeit dieselbe ist wie bei echten Konten (keine Enumeration).
 */
const DUMMY_HASH = hashPassword("pw-timing-equalizer-kein-echtes-konto");

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

export async function login(
  email: string,
  password: string,
  totpCode?: string,
): Promise<
  | { ok: true; mustChangePassword: boolean }
  | {
      ok: false;
      error: string;
      needsTotp?: boolean;
      needsTotpSetup?: boolean;
      qrDataUrl?: string;
      totpSecret?: string;
    }
> {
  const { ip, userAgent } = await requestMeta();

  const { istIpGesperrt, istEmailGesperrt, verifyTotp, totpEinmalVerbrauchen } =
    await import("./security");

  // IP-Drosselung: bei zu vielen Fehlversuchen sofort blocken (spart auch die
  // teure scrypt-Berechnung) und den Versuch zählen.
  if (await istIpGesperrt(ip)) {
    await sql`
      insert into admin.login_event (employee_id, email, success, ip, user_agent)
      values (null, ${email}, false, ${ip}, ${userAgent})`;
    return {
      ok: false,
      error:
        "Zu viele Fehlversuche von dieser Verbindung. Bitte in 15 Minuten erneut versuchen.",
    };
  }

  // Anmeldung per E-Mail ODER Username (beides case-insensitive).
  const rows = await sql`
    select e.id, e.password_hash, e.status, e.totp_enabled, e.totp_secret,
           e.must_change_password, e.role_id
    from admin.employee e
    where (lower(e.email) = lower(${email}) or lower(e.username) = lower(${email}))
      and e.deleted_at is null
    limit 1`;

  const employee = rows[0];
  const usable = Boolean(
    employee && employee.status === "ACTIVE" && employee.password_hash,
  );
  // Immer scrypt ausführen — gegen echten Hash oder Dummy — damit die Laufzeit
  // bei unbekanntem/inaktivem Konto identisch ist (keine Timing-Enumeration).
  const passwordValid =
    verifyPassword(
      password,
      usable ? (employee.password_hash as string) : DUMMY_HASH,
    ) && usable;

  // 2FA: Passwort korrekt, aber Code fehlt → zweiter Schritt, kein Fehlversuch.
  if (passwordValid && employee.totp_enabled && !totpCode) {
    return { ok: false, needsTotp: true, error: "" };
  }

  // 2FA verpflichtend, aber noch nicht eingerichtet → Einrichtung als ZWEITER
  // Login-Schritt (QR + Code direkt im Login, statt Redirect auf /konto).
  // Passwort ist an dieser Stelle korrekt.
  if (
    passwordValid &&
    !employee.totp_enabled &&
    rolleBrauchtZweiFaktor(employee.role_id as string)
  ) {
    const { generateTotpSecret, totpKeyUri } = await import("./security");
    const QRCode = (await import("qrcode")).default;
    // Vorhandenes Secret wiederverwenden, damit ein bereits gescannter QR-Code
    // gültig bleibt; sonst neu erzeugen und speichern (noch nicht aktiv).
    let secret = (employee.totp_secret as string | null) ?? null;
    if (!secret) {
      secret = generateTotpSecret();
      await sql`
        update admin.employee set totp_secret = ${secret}, updated_at = now()
        where id = ${employee.id} and totp_enabled = false`;
    }
    const qr = async () =>
      QRCode.toDataURL(totpKeyUri(email, secret as string), { margin: 1, width: 220 });

    if (!totpCode) {
      return {
        ok: false,
        needsTotpSetup: true,
        error: "",
        qrDataUrl: await qr(),
        totpSecret: secret,
      };
    }
    // Code geliefert → prüfen; bei Erfolg 2FA aktivieren und normal einloggen.
    const codeOk = await verifyTotp(secret, totpCode);
    if (!codeOk) {
      await sql`
        insert into admin.login_event (employee_id, email, success, ip, user_agent)
        values (${employee.id}, ${email}, false, ${ip}, ${userAgent})`;
      return {
        ok: false,
        needsTotpSetup: true,
        error: "Der Code ist nicht korrekt — bitte erneut aus der App eingeben.",
        qrDataUrl: await qr(),
        totpSecret: secret,
      };
    }
    await sql`
      update admin.employee set totp_enabled = true, updated_at = now()
      where id = ${employee.id}`;
    // Sicherheits-Benachrichtigung an die hinterlegte Adresse — falls ein
    // Angreifer mit bekanntem Passwort ein eigenes Gerät gebunden hat, erfährt
    // der echte Kontoinhaber davon. Fehler dürfen den Login nicht blockieren.
    try {
      const [ez] = await sql`
        select email, name from admin.employee where id = ${employee.id}`;
      if (ez?.email) {
        const { queueEmail } = await import("./mailer");
        const { renderBrandedText } = await import("./email-templates");
        const r = renderBrandedText(
          "Zwei-Faktor-Authentifizierung aktiviert",
          `Hallo ${(ez.name as string) ?? ""},\n\nfür dein Konto wurde soeben die Zwei-Faktor-Authentifizierung eingerichtet.\n\nWarst du das nicht, ändere sofort dein Passwort und wende dich an einen Administrator.`,
        );
        await queueEmail({
          toEmail: ez.email as string,
          toName: ez.name as string | null,
          subject: r.subject,
          body: r.text,
          html: r.html,
          kind: "SYSTEM",
          entityType: "employee",
          entityId: employee.id as string,
        });
      }
    } catch (e) {
      console.error("2FA-Aktivierungs-Benachrichtigung fehlgeschlagen", e);
    }
    // Fällt bewusst durch: employee.totp_enabled (lokal) ist noch false, daher
    // überspringt die Code-Prüfung unten und der Login wird als gültig gewertet.
  }

  let totpValid = true;
  if (usable && employee.totp_enabled) {
    const codeOk =
      Boolean(totpCode) &&
      (await verifyTotp(employee.totp_secret as string, totpCode as string));
    // Replay-Schutz: ein gültiger Code zählt nur, wenn er nicht bereits
    // innerhalb der letzten 90 s verbraucht wurde.
    totpValid =
      codeOk &&
      (await totpEinmalVerbrauchen(employee.id as string, totpCode as string));
  }

  const valid = Boolean(passwordValid && totpValid);

  await sql`
    insert into admin.login_event (employee_id, email, success, ip, user_agent)
    values (${employee?.id ?? null}, ${email}, ${valid}, ${ip}, ${userAgent})`;

  if (!valid) {
    if (passwordValid && !totpValid) {
      // 2FA-Brute-Force ebenfalls kontobezogen drosseln (der Fehlversuch wurde
      // oben bereits in login_event gezählt).
      if (await istEmailGesperrt(email)) {
        return {
          ok: false,
          error: "Zu viele Fehlversuche. Der Login ist für 15 Minuten gesperrt.",
        };
      }
      return {
        ok: false,
        needsTotp: true,
        error: "Der 2FA-Code ist nicht korrekt.",
      };
    }
    // Konto-Sperre greift NUR hier (falsche Zugangsdaten) — ein korrektes
    // Passwort wird oben nie geblockt, daher kein Aussperr-DoS für Kollegen.
    if (await istEmailGesperrt(email)) {
      return {
        ok: false,
        error: "Zu viele Fehlversuche. Der Login ist für 15 Minuten gesperrt.",
      };
    }
    return { ok: false, error: "E-Mail oder Passwort ist nicht korrekt." };
  }

  // Opportunistisches Rehashing auf aktuelle Kostenparameter.
  if (needsRehash(employee.password_hash as string)) {
    try {
      await sql`
        update admin.employee set password_hash = ${hashPassword(password)}
        where id = ${employee.id}`;
    } catch (e) {
      console.error("Rehash fehlgeschlagen", e);
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);

  await sql`
    insert into admin.session (token_hash, employee_id, ip, user_agent, expires_at)
    values (${sha256(token)}, ${employee.id}, ${ip}, ${userAgent}, ${expiresAt})`;
  await sql`
    update admin.employee
    set last_login_at = now(), last_seen_at = now(),
        presence = case when presence = 'IM_CALL' then 'AVAILABLE' else presence end
    where id = ${employee.id}`;

  // Cookie lebt länger als das 24h-DB-Fenster (Container); die rollierende
  // DB-Sitzung ist das eigentliche Gate. So übersteht der Login auch einen
  // Browser-Neustart, solange innerhalb von 24 h weitergearbeitet wird.
  const cookieExpires = new Date(
    Date.now() + SESSION_COOKIE_DAYS * 24 * 3600 * 1000,
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: cookieExpires,
  });

  return {
    ok: true,
    mustChangePassword: Boolean(employee.must_change_password),
  };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`
      update admin.session set revoked_at = now()
      where token_hash = ${sha256(token)} and revoked_at is null`;
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Resolve the current employee from the session cookie.
 * Cached per request — safe to call from any server component or action.
 */
export const getEmployee = cache(async (): Promise<Employee | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await sql`
    select e.id, e.email, e.name, e.avatar_color, e.avatar_url, e.team,
           e.must_change_password, e.totp_enabled, e.onboarded_at, e.permission_overrides,
           r.id as role_id, r.name as role_name, r.permissions, r.level
    from admin.session s
    join admin.employee e on e.id = s.employee_id and e.deleted_at is null
    join admin.role r on r.id = e.role_id
    where s.token_hash = ${sha256(token)}
      and s.revoked_at is null
      and s.expires_at > now()
      and e.status = 'ACTIVE'
    limit 1`;

  const row = rows[0];
  if (!row) return null;

  // Firewall (Schicht 2): dynamisch gebannte IPs gelten auch für bestehende
  // Sitzungen — Seiten UND API-Routen. Fail-open bei Fehlern (nie aussperren).
  try {
    if (await istIpGebannt(await aktuelleClientIp())) return null;
  } catch {
    /* fail-open */
  }

  // Effektive Rechte: individuelle Overrides haben Vorrang; sonst die Rolle.
  // Bestehende Konten haben permission_overrides = NULL ⇒ Verhalten unverändert.
  const overrides = row.permission_overrides as PermissionMap | null;
  const hasCustom = Boolean(overrides && Object.keys(overrides).length > 0);
  const effektiv = hasCustom ? overrides! : (row.permissions as PermissionMap);

  // Rollierende Sitzung: bei Aktivität wieder auf volle 24 h setzen. Gedrosselt
  // — nur verlängern, wenn weniger als (TTL−1) h übrig sind (höchstens ~1×/Stunde
  // ein DB-Write). Aktives Ausloggen (revoked_at) und Deaktivierung greifen sofort.
  await sql`
    update admin.session
    set expires_at = now() + (${SESSION_TTL_HOURS} || ' hours')::interval
    where token_hash = ${sha256(token)} and revoked_at is null
      and expires_at < now() + (${SESSION_TTL_HOURS - 1} || ' hours')::interval`;

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    roleId: row.role_id as string,
    roleName: row.role_name as string,
    roleLevel: Number(row.level ?? 20),
    permissions: effektiv,
    hasCustomPermissions: hasCustom,
    avatarColor: row.avatar_color as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    team: (row.team as string) ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    totpEnabled: Boolean(row.totp_enabled),
    onboardedAt: (row.onboarded_at as Date | null) ?? null,
  };
});

/**
 * Server-side gate for pages and actions. Redirects to /login when
 * unauthenticated and to the dashboard when the permission is missing.
 */
export async function requireEmployee(
  module?: PermissionModule,
  action: PermissionAction = "view",
): Promise<Employee> {
  const employee = await getEmployee();
  if (!employee) redirect("/login");

  // Pflicht-Gates (Passwort setzen, 2FA für Admins) — außer auf der Konto-Seite
  // selbst, damit sie dort erfüllt werden können.
  const path = (await headers()).get("x-pathname") ?? "";
  if (!path.startsWith("/konto")) {
    if (employee.mustChangePassword) redirect("/konto?erst=1");
    // Erstlogin-Assistent: 2FA + Handy-Push Schritt für Schritt einrichten.
    if (!employee.onboardedAt && !path.startsWith("/willkommen")) {
      redirect("/willkommen");
    }
    if (
      !path.startsWith("/willkommen") &&
      rolleBrauchtZweiFaktor(employee.roleId) &&
      !employee.totpEnabled
    ) {
      redirect("/konto?2fa=1");
    }
  }

  if (module && !hasPermission(employee.permissions, module, action)) {
    redirect("/?fehlt=" + module);
  }
  return employee;
}

/** Non-redirecting variant for server actions — throws instead. */
export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): Promise<Employee> {
  const employee = await getEmployee();
  if (!employee) throw new Error("Nicht angemeldet.");
  // Pflicht-Gates hart durchsetzen (nicht nur als Seiten-Redirect): ein Konto,
  // das das Passwort ändern oder 2FA einrichten muss, darf keine mutierenden
  // Actions ausführen. Die Konto-Selbstverwaltung nutzt getEmployee, nicht diese
  // Funktion, und bleibt daher erreichbar.
  if (employee.mustChangePassword) {
    throw new Error("Bitte zuerst dein Passwort ändern (Konto → Sicherheit).");
  }
  if (rolleBrauchtZweiFaktor(employee.roleId) && !employee.totpEnabled) {
    throw new Error(
      "Zwei-Faktor-Authentifizierung ist für deine Rolle erforderlich (Konto → Sicherheit).",
    );
  }
  if (!hasPermission(employee.permissions, module, action)) {
    throw new Error("Keine Berechtigung für diese Aktion.");
  }
  return employee;
}

export function can(
  employee: Employee,
  module: PermissionModule,
  action: PermissionAction = "view",
): boolean {
  return hasPermission(employee.permissions, module, action);
}
