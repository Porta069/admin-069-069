/**
 * „Passwort zurücksetzen"-E-Mail (Porta Jobs) — markengetreues, editierbares
 * Template. Isomorph nutzbar (keine DB/Server-Only): für die Live-Vorschau im
 * Browser UND den Versand serverseitig.
 *
 * JEDES Feld ist editierbar (inkl. Logo & Markenfarben). Der Default unten wird
 * IMMER vorgehalten (Zurücksetzen auf Standard). Variablen im Text:
 *   {{name}}       – optionaler Empfängername (Anrede)
 *   {{reset_url}}  – Ziel des Buttons (der eigentliche Reset-Link)
 *   {{brand}}      – Markenname, farbig/fett hervorgehoben
 */

import { PORTAJOBS_LOGO_DATA_URI } from "./portajobs-logo";

export interface ResetEmailConfig {
  logoUrl: string;
  colorOrange: string;
  colorPetrol: string;
  subject: string;
  brand: string;
  headlineTop: string;
  headlineBottom: string;
  greeting: string;
  intro: string;
  ctaHint: string;
  buttonLabel: string;
  buttonUrl: string;
  infoBox: string;
  noteBox: string;
  signOff: string;
  signTeam: string;
  footerAccent: string;
  footerRest: string;
}

export const DEFAULT_RESET_EMAIL: ResetEmailConfig = {
  logoUrl: PORTAJOBS_LOGO_DATA_URI,
  colorOrange: "#F5A623",
  colorPetrol: "#125A50",
  subject: "Passwort zurücksetzen",
  brand: "Portajobs",
  headlineTop: "Passwort",
  headlineBottom: "zurücksetzen",
  greeting: "Hallo,",
  intro: "wir haben eine Anfrage erhalten, das Passwort für dein {{brand}}-Konto zurückzusetzen.",
  ctaHint: "Klicke auf den folgenden Button, um ein neues Passwort festzulegen:",
  buttonLabel: "Passwort zurücksetzen",
  buttonUrl: "{{reset_url}}",
  infoBox: "Der Link ist aus Sicherheitsgründen nur für eine begrenzte Zeit gültig.",
  noteBox:
    "Falls du dein Passwort nicht zurücksetzen möchtest oder diese Anfrage nicht von dir stammt, kannst du diese E-Mail einfach ignorieren. Dein bisheriges Passwort bleibt unverändert.",
  signOff: "Viele Grüße",
  signTeam: "Dein {{brand}}-Team",
  footerAccent: "Gefunden werden",
  footerRest: "statt Job suchen.",
};

/** Fehlende Felder mit dem Default auffüllen (robuste Teilkonfiguration). */
export function mitDefaults(partial: Partial<ResetEmailConfig> | null | undefined): ResetEmailConfig {
  return { ...DEFAULT_RESET_EMAIL, ...(partial ?? {}) };
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function substituteVars(text: string, vars: Record<string, string>): string {
  return String(text ?? "").replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in vars ? vars[k] : m,
  );
}

/** Text escapen, dann {{brand}} farbig/fett + Zeilenumbrüche als <br>. */
function richText(text: string, brand: string, orange: string): string {
  return esc(text)
    .replace(/\{\{brand\}\}/g, `<span style="color:${orange};font-weight:700;">${esc(brand)}</span>`)
    .replace(/\n/g, "<br>");
}

export interface GerenderteEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Rendert die Reset-E-Mail. `vars.reset_url` ist der eigentliche Reset-Link;
 * `vars.name` (optional) personalisiert die Anrede.
 */
export function renderResetEmail(
  cfg: ResetEmailConfig,
  vars: { reset_url?: string; name?: string } = {},
): GerenderteEmail {
  const orange = cfg.colorOrange;
  const petrol = cfg.colorPetrol;
  const brand = cfg.brand;
  const ink = "#374151";
  const v = { reset_url: vars.reset_url ?? "#", name: vars.name ?? "" };

  const greeting = substituteVars(cfg.greeting, v).trim();
  const buttonUrl = substituteVars(cfg.buttonUrl, v);
  const subject = substituteVars(cfg.subject, v);

  const lockSvg =
    `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<rect x="4.5" y="10" width="15" height="10.5" rx="2.5" stroke="${petrol}" stroke-width="1.6"/>` +
    `<path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="${petrol}" stroke-width="1.6"/>` +
    `<circle cx="12" cy="15" r="1.6" fill="${petrol}"/></svg>`;

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef0ee;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ee;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <!-- Kopf mit dezenten Licht-Caustics (moderne Clients) -->
  <tr><td style="padding:40px 40px 8px;background:#fdfcfa;background-image:radial-gradient(120px 120px at 8% 0%, ${orange}22, transparent 70%),radial-gradient(200px 200px at 100% 8%, ${petrol}22, transparent 70%);" align="center">
    <img src="${esc(cfg.logoUrl)}" alt="${esc(brand)}" height="34" style="height:34px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
  </td></tr>

  <!-- Schloss-Icon -->
  <tr><td align="center" style="padding:22px 40px 0;background:#fdfcfa;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background:#eef2f0;border-radius:50%;">${lockSvg}</td>
    </tr></table>
  </td></tr>

  <!-- Headline -->
  <tr><td align="center" style="padding:18px 40px 0;background:#fdfcfa;">
    <div style="font-size:44px;line-height:1.02;font-weight:800;color:${petrol};letter-spacing:-0.5px;">${esc(cfg.headlineTop)}</div>
    <div style="font-size:44px;line-height:1.02;font-weight:800;color:${orange};letter-spacing:-0.5px;margin-top:2px;">${esc(cfg.headlineBottom)}</div>
  </td></tr>

  <!-- Divider -->
  <tr><td align="center" style="padding:22px 40px 6px;background:#fdfcfa;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:70px;border-top:1px solid #e2e5e3;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${orange};"></span></td>
      <td style="width:70px;border-top:1px solid #e2e5e3;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:14px 40px 0;background:#fdfcfa;font-size:16px;line-height:1.6;color:${ink};">
    ${greeting ? `<p style="margin:0 0 14px;font-weight:700;color:#1f2937;">${richText(greeting, brand, orange)}</p>` : ""}
    <p style="margin:0 0 16px;">${richText(cfg.intro, brand, orange)}</p>
    <p style="margin:0 0 24px;">${richText(cfg.ctaHint, brand, orange)}</p>
  </td></tr>

  <!-- Button (bulletproof) -->
  <tr><td align="center" style="padding:0 40px 6px;background:#fdfcfa;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      <tr><td align="center" bgcolor="${orange}" style="border-radius:12px;background:${orange};background-image:linear-gradient(180deg, ${orange}, ${orange}dd);box-shadow:0 8px 20px -6px ${orange}66;">
        <a href="${esc(buttonUrl)}" style="display:block;padding:18px 24px;font-size:15px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
          &#8594;&nbsp;&nbsp;${esc(cfg.buttonLabel)}
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Info-Box (Petrol-Rand) -->
  <tr><td style="padding:24px 40px 0;background:#fdfcfa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#f1f4f2;border-left:4px solid ${petrol};border-radius:8px;padding:16px 20px;font-size:15px;line-height:1.55;color:${ink};">
        ${richText(cfg.infoBox, brand, orange)}
      </td>
    </tr></table>
  </td></tr>

  <!-- Hinweis-Box (Orange-Rand) -->
  <tr><td style="padding:16px 40px 0;background:#fdfcfa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#fdeede;border-left:4px solid ${orange};border-radius:8px;padding:16px 20px;font-size:14px;line-height:1.55;color:#6b5b45;">
        ${richText(cfg.noteBox, brand, orange)}
      </td>
    </tr></table>
  </td></tr>

  <!-- Signatur -->
  <tr><td style="padding:28px 40px 36px;background:#fdfcfa;font-size:16px;line-height:1.5;color:${ink};">
    <div style="font-weight:700;color:#1f2937;">${richText(cfg.signOff, brand, orange)}</div>
    <div>${richText(cfg.signTeam, brand, orange)}</div>
  </td></tr>

  <!-- Footer-Leiste -->
  <tr><td align="center" style="background:${petrol};padding:20px 24px;">
    <span style="font-size:15px;font-weight:700;color:${orange};">${esc(cfg.footerAccent)}</span>
    <span style="font-size:15px;color:#ffffff;">&nbsp;${esc(cfg.footerRest)}</span>
  </td></tr>

</table>
</td></tr></table></body></html>`;

  const plain = [
    greeting,
    substituteVars(cfg.intro.replace(/\{\{brand\}\}/g, brand), v),
    substituteVars(cfg.ctaHint, v),
    `${cfg.buttonLabel}: ${buttonUrl}`,
    cfg.infoBox,
    cfg.noteBox,
    cfg.signOff,
    cfg.signTeam.replace(/\{\{brand\}\}/g, brand),
    `${cfg.footerAccent} ${cfg.footerRest}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, html, text: plain };
}
