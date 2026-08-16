/**
 * Markengetreues E-Mail-HTML (Porta Jobs) aus einer Benachrichtigungs-Vorlage.
 * Isomorph nutzbar — ohne DB/Server-Only — für die Live-Vorschau im Browser
 * UND den Versand serverseitig. Zwei Layouts: „brief" und „zentriert".
 */

import { PORTA_WERK_LOGO_DATA_URI } from "./porta-werk-logo";

const GRUEN = "#115F5B";
const GELB = "#F9AD07";
const TINT = "rgba(17,95,91,0.08)";
const RAND = "rgba(17,95,91,0.22)";
const FUSS = "Porta Werk · porta-werk.de";

export interface VorlageDaten {
  variante: string;
  titel: string;
  betreff: string;
  einleitung: string;
  schluss: string;
  hervorhebung?: string | null;
}

export interface GerenderteEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nl2br = (s: unknown) => esc(s).replace(/\n/g, "<br>");

/** Ersetzt {{key}} durch die übergebenen Werte. Unbekannte Platzhalter bleiben. */
export function substituteVars(text: string, vars: Record<string, string>): string {
  return String(text ?? "").replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in vars ? vars[k] : m,
  );
}

function shell(inner: string, gray: boolean): string {
  const bg = gray ? "#f3f4f6" : "#e9ecef";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};">
<tr><td align="center" style="padding:24px 12px;">${inner}</td></tr></table></body></html>`;
}

function badge(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-block;background:#ffffff;border-radius:8px;"><tr>
<td style="padding:8px 12px;line-height:0;"><img src="${PORTA_WERK_LOGO_DATA_URI}" alt="Porta Werk" height="26" style="height:26px;width:auto;display:block;border:0;" /></td>
</tr></table>`;
}

function hervorhebungBox(text: string): string {
  const zeilen = text.split("\n").map((z) => z.trim()).filter(Boolean);
  if (!zeilen.length) return "";
  const [kopf, ...rest] = zeilen;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;max-width:420px;width:100%;">
  <tr><td style="background:${TINT};border:1px solid ${RAND};border-radius:12px;padding:20px 24px;">
    <div style="color:${GRUEN};font-size:20px;font-weight:bold;letter-spacing:.03em;">${esc(kopf)}</div>
    ${rest.length ? `<div style="margin-top:6px;font-size:13px;color:#6b7280;word-break:break-all;">${esc(rest.join(" "))}</div>` : ""}
  </td></tr></table>`;
}

function briefHtml(d: VorlageDaten): string {
  const herv = d.hervorhebung ? hervorhebungBox(d.hervorhebung) : "";
  return shell(
    `<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td style="background:${GRUEN};padding:26px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="left" valign="middle">${badge()}</td>
      <td align="right" valign="middle" style="color:#ffffff;font-size:20px;font-weight:bold;">${esc(d.titel)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:${GELB};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:36px 40px;color:#374151;font-size:14px;line-height:1.6;">
    ${d.betreff ? `<p style="margin:0 0 12px;font-weight:bold;color:#111827;font-size:14px;">${esc(d.betreff)}</p>` : ""}
    <p style="margin:0;color:#374151;">${nl2br(d.einleitung)}</p>
    ${herv}
    ${d.schluss ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#4b5563;">${nl2br(d.schluss)}</div>` : ""}
  </td></tr>
  <tr><td style="height:2px;background:${GRUEN};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:#f9fafb;padding:16px 40px;color:#6b7280;font-size:12px;">${esc(FUSS)}</td></tr>
</table>`,
    true,
  );
}

function zentriertHtml(d: VorlageDaten): string {
  const hz = String(d.hervorhebung || "").split("\n").map((z) => z.trim()).filter(Boolean);
  let herv = "";
  if (hz.length) {
    if (hz.length >= 2) {
      const href = hz.slice(1).join(" ");
      herv = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;"><tr>
        <td style="background:${GRUEN};border-radius:6px;">
          <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">${esc(hz[0])}</a>
        </td></tr></table>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">${esc(href)}</p>`;
    } else {
      herv = `<div style="margin:28px 0 0;text-align:center;">
        <span style="display:inline-block;border:2px solid ${RAND};background:${TINT};color:${GRUEN};border-radius:10px;padding:16px 32px;font-size:30px;font-weight:bold;letter-spacing:.25em;">${esc(hz[0])}</span>
      </div>`;
    }
  }
  return shell(
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#f3f4f6;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <tr><td align="center" style="background:${GRUEN};padding:30px;">${badge()}</td></tr>
  <tr><td style="padding:32px 24px;">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" align="center" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:40px 36px;font-family:Arial,Helvetica,sans-serif;">
        <h1 style="margin:0;text-align:center;color:#111827;font-size:22px;font-weight:bold;">${esc(d.titel)}</h1>
        <p style="margin:22px 0 0;color:#374151;font-size:14px;line-height:1.6;">${nl2br(d.einleitung)}</p>
        ${herv}
        ${d.schluss ? `<p style="margin:28px 0 0;color:#4b5563;font-size:14px;line-height:1.6;">${nl2br(d.schluss)}</p>` : ""}
      </td></tr>
    </table>
    <p style="margin:20px auto 0;max-width:480px;text-align:center;color:#6b7280;font-size:12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">${esc(FUSS)}</p>
  </td></tr>
</table>`,
    false,
  );
}

/** Rendert eine Vorlage mit Variablen zu Betreff, Text-Fallback und HTML. */
export function renderVorlageEmail(
  v: VorlageDaten,
  vars: Record<string, string>,
): GerenderteEmail {
  const d: VorlageDaten = {
    variante: v.variante,
    titel: substituteVars(v.titel, vars),
    betreff: substituteVars(v.betreff, vars),
    einleitung: substituteVars(v.einleitung, vars),
    schluss: substituteVars(v.schluss, vars),
    hervorhebung: v.hervorhebung ? substituteVars(v.hervorhebung, vars) : "",
  };
  const html = d.variante === "zentriert" ? zentriertHtml(d) : briefHtml(d);
  const text = [d.titel, "", d.betreff, "", d.einleitung, d.hervorhebung ? "\n" + d.hervorhebung : "", "", d.schluss]
    .filter((x) => x !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: d.betreff, text, html };
}
