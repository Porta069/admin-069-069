/**
 * Markengetreues E-Mail-HTML (Porta Jobs) aus einer Benachrichtigungs-Vorlage.
 * Isomorph nutzbar — ohne DB/Server-Only — für die Live-Vorschau im Browser
 * UND den Versand serverseitig.
 *
 * Design identisch zur Passwort-Reset-E-Mail (src/lib/reset-email.ts): warmer
 * Kopf mit Portajobs-Logo, zentrierte Headline, Text, optionaler Aktion
 * (Button ODER Code/Hinweis-Box via `hervorhebung`) und Petrol-Footer-Leiste.
 * Nur der Text unterscheidet sich je Vorlage.
 */

import { PORTAJOBS_LOGO_DATA_URI } from "./portajobs-logo";

const ORANGE = "#F5A623";
const PETROL = "#125A50";
const INK = "#374151";
const FOOTER_ACCENT = "Gefunden werden";
const FOOTER_REST = "statt Job suchen.";

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
const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

/** Ersetzt {{key}} durch die übergebenen Werte. Unbekannte Platzhalter bleiben. */
export function substituteVars(text: string, vars: Record<string, string>): string {
  return String(text ?? "").replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in vars ? vars[k] : m,
  );
}

function button(url: string, label: string): string {
  return `<tr><td align="center" style="padding:4px 40px 6px;background:#fdfcfa;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
      <tr><td align="center" bgcolor="${ORANGE}" style="border-radius:12px;background:${ORANGE};background-image:linear-gradient(180deg, ${ORANGE}, ${ORANGE}dd);box-shadow:0 8px 20px -6px ${ORANGE}66;">
        <a href="${esc(url)}" style="display:block;padding:18px 24px;font-size:15px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">&#8594;&nbsp;&nbsp;${esc(label)}</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function codeBox(code: string): string {
  return `<tr><td align="center" style="padding:8px 40px 0;background:#fdfcfa;">
    <span style="display:inline-block;background:#f1f4f2;border:1px solid ${PETROL};border-radius:12px;padding:18px 34px;font-family:'Courier New',monospace;font-size:30px;font-weight:800;letter-spacing:.22em;color:${PETROL};">${esc(code)}</span>
  </td></tr>`;
}

function infoBox(text: string): string {
  return `<tr><td style="padding:24px 40px 0;background:#fdfcfa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#f1f4f2;border-left:4px solid ${PETROL};border-radius:8px;padding:16px 20px;font-size:15px;line-height:1.55;color:${INK};">${nl2br(text)}</td>
    </tr></table>
  </td></tr>`;
}

/** hervorhebung → Button (Label+Link), Code (einzeilig) oder Hinweis-Box. */
function hervorhebungBlock(text: string): string {
  const lines = text.split("\n").map((z) => z.trim()).filter(Boolean);
  if (!lines.length) return "";
  const last = lines[lines.length - 1];
  if (isUrl(last)) {
    const label = lines.length > 1 ? lines.slice(0, -1).join(" ") : "Jetzt öffnen";
    return button(last, label);
  }
  if (lines.length === 1) return codeBox(lines[0]);
  return infoBox(lines.join("\n"));
}

function renderHtml(d: VorlageDaten): string {
  const herv = d.hervorhebung ? hervorhebungBlock(d.hervorhebung) : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(d.betreff || d.titel)}</title></head>
<body style="margin:0;padding:0;background:#eef0ee;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ee;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

  <tr><td style="padding:40px 40px 8px;background:#fdfcfa;background-image:radial-gradient(120px 120px at 8% 0%, ${ORANGE}22, transparent 70%),radial-gradient(200px 200px at 100% 8%, ${PETROL}22, transparent 70%);" align="center">
    <img src="${PORTAJOBS_LOGO_DATA_URI}" alt="Porta Jobs" height="34" style="height:34px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
  </td></tr>

  ${d.titel ? `<tr><td align="center" style="padding:24px 40px 0;background:#fdfcfa;">
    <div style="font-size:34px;line-height:1.1;font-weight:800;color:${PETROL};letter-spacing:-0.4px;">${esc(d.titel)}</div>
  </td></tr>
  <tr><td align="center" style="padding:18px 40px 6px;background:#fdfcfa;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:60px;border-top:1px solid #e2e5e3;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:0 8px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${ORANGE};"></span></td>
      <td style="width:60px;border-top:1px solid #e2e5e3;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>` : ""}

  <tr><td style="padding:14px 40px 0;background:#fdfcfa;font-size:16px;line-height:1.6;color:${INK};">
    ${d.betreff ? `<p style="margin:0 0 12px;font-weight:700;color:#1f2937;">${esc(d.betreff)}</p>` : ""}
    <p style="margin:0 0 4px;">${nl2br(d.einleitung)}</p>
  </td></tr>

  ${herv}

  ${d.schluss ? `<tr><td style="padding:26px 40px 8px;background:#fdfcfa;font-size:16px;line-height:1.6;color:${INK};">${nl2br(d.schluss)}</td></tr>` : ""}

  <tr><td style="height:24px;background:#fdfcfa;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td align="center" style="background:${PETROL};padding:20px 24px;">
    <span style="font-size:15px;font-weight:700;color:${ORANGE};">${FOOTER_ACCENT}</span>
    <span style="font-size:15px;color:#ffffff;">&nbsp;${FOOTER_REST}</span>
  </td></tr>

</table>
</td></tr></table></body></html>`;
}

/**
 * Beliebigen (bereits fertig personalisierten) Text ins Marken-Layout setzen —
 * für Kampagnen und Automationen, die keine Benachrichtigungs-Vorlage nutzen.
 * Betreff wird zur Headline, der Text zum Fließtext; Footer wie überall.
 */
export function renderBrandedText(subject: string, bodyText: string): GerenderteEmail {
  const r = renderVorlageEmail(
    {
      variante: "brief",
      titel: subject,
      betreff: "",
      einleitung: bodyText,
      schluss: "",
      hervorhebung: "",
    },
    {},
  );
  return { ...r, subject };
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
  const html = renderHtml(d);
  const text = [
    d.titel,
    "",
    d.betreff,
    "",
    d.einleitung,
    d.hervorhebung ? "\n" + d.hervorhebung : "",
    "",
    d.schluss,
    "",
    `${FOOTER_ACCENT} ${FOOTER_REST}`,
  ]
    .filter((x) => x !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: d.betreff, text, html };
}
