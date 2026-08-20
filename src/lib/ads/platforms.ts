import type { StatusDef } from "@/lib/definitions";
import { BEREICHE } from "@/lib/matching/catalog";

/**
 * Plattform-Registry der Werbe-Abteilung. Isomorph (kein Secret, kein
 * server-only) — treibt die UI: es werden nur Optionen angezeigt, die die
 * jeweilige Plattform-API unterstützt. Neue Plattformen werden hier ergänzt.
 */

export type Provider = "meta" | "snapchat";
export type PlatformId = "meta_instagram" | "meta_facebook" | "snapchat";

export interface PlatformCapabilities {
  customAudiences: boolean;
  websiteVisitors: boolean;
  registeredUsers: boolean;
  lookalike: boolean;
  radiusTargeting: boolean;
  interests: boolean;
  berufe: boolean;
  gender: boolean;
  ageRange: boolean;
  /** Unterstützte Seitenverhältnisse für Creatives. */
  formats: string[];
}

export interface PlatformDef {
  id: PlatformId;
  label: string;
  provider: Provider;
  icon: string;
  envVars: string[];
  capabilities: PlatformCapabilities;
}

export const META_ENV = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
];
export const SNAP_ENV = [
  "SNAPCHAT_CLIENT_ID",
  "SNAPCHAT_CLIENT_SECRET",
  "SNAPCHAT_ACCESS_TOKEN",
  "SNAPCHAT_AD_ACCOUNT_ID",
];

const META_CAPS: PlatformCapabilities = {
  customAudiences: true,
  websiteVisitors: true,
  registeredUsers: true,
  lookalike: true,
  radiusTargeting: true,
  interests: true,
  berufe: true,
  gender: true,
  ageRange: true,
  formats: ["9:16", "1:1", "4:5", "16:9"],
};

const SNAP_CAPS: PlatformCapabilities = {
  customAudiences: true,
  websiteVisitors: true,
  registeredUsers: true,
  lookalike: true,
  radiusTargeting: true,
  interests: true,
  berufe: false, // Snapchat kennt keine spezifischen Handwerksberufe als Targeting
  gender: true,
  ageRange: true,
  formats: ["9:16"],
};

export const PLATFORMS: PlatformDef[] = [
  {
    id: "meta_instagram",
    label: "Instagram",
    provider: "meta",
    icon: "📸",
    envVars: META_ENV,
    capabilities: META_CAPS,
  },
  {
    id: "meta_facebook",
    label: "Facebook",
    provider: "meta",
    icon: "👍",
    envVars: META_ENV,
    capabilities: META_CAPS,
  },
  {
    id: "snapchat",
    label: "Snapchat",
    provider: "snapchat",
    icon: "👻",
    envVars: SNAP_ENV,
    capabilities: SNAP_CAPS,
  },
];

export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));
export const platformLabel = (id: string) => PLATFORM_BY_ID.get(id as PlatformId)?.label ?? id;

/** Fähigkeiten aller gewählten Plattformen kombiniert (Schnittmenge = konservativ). */
export function combinedCaps(ids: string[]): PlatformCapabilities {
  const chosen = ids
    .map((i) => PLATFORM_BY_ID.get(i as PlatformId))
    .filter((p): p is PlatformDef => Boolean(p));
  if (chosen.length === 0) return { ...META_CAPS, berufe: true };
  const and = (k: keyof PlatformCapabilities) =>
    chosen.every((c) => Boolean(c.capabilities[k]));
  // Formate: nur was ALLE unterstützen.
  const formats = chosen
    .map((c) => c.capabilities.formats)
    .reduce((acc, f) => acc.filter((x) => f.includes(x)));
  return {
    customAudiences: and("customAudiences"),
    websiteVisitors: and("websiteVisitors"),
    registeredUsers: and("registeredUsers"),
    lookalike: and("lookalike"),
    radiusTargeting: and("radiusTargeting"),
    interests: and("interests"),
    berufe: and("berufe"),
    gender: and("gender"),
    ageRange: and("ageRange"),
    formats,
  };
}

// ── Kampagnen-Vokabular ─────────────────────────────────────────────────────

export const CAMPAIGN_STATUS: Record<string, StatusDef> = {
  DRAFT: { label: "Entwurf", tone: "neutral" },
  ACTIVE: { label: "Aktiv", tone: "success" },
  PAUSED: { label: "Pausiert", tone: "warning" },
  ENDED: { label: "Beendet", tone: "neutral" },
  ERROR: { label: "Fehler", tone: "danger" },
};

export const ZIELE = [
  { value: "REGISTRATIONS", label: "Registrierungen", empfohlen: true },
  { value: "LEADS", label: "Leads" },
  { value: "APPLICATIONS", label: "Bewerbungen" },
  { value: "TRAFFIC", label: "Website-Besucher / Traffic" },
  { value: "REACH", label: "Reichweite" },
] as const;

export const CTAS = [
  { value: "SIGN_UP", label: "Jetzt registrieren" },
  { value: "LEARN_MORE", label: "Mehr erfahren" },
  { value: "APPLY_NOW", label: "Jetzt bewerben" },
  { value: "VISIT_WEBSITE", label: "Website besuchen" },
] as const;

/** Conversion-Events für die Jobbörse (Meta CAPI / Snapchat CAPI). */
export const TRACKING_EVENTS = [
  "PageView",
  "LandingPageView",
  "RegistrationStarted",
  "RegistrationCompleted",
  "Login",
  "JobSearch",
  "JobView",
  "ApplicationStarted",
  "ApplicationCompleted",
] as const;

export const LAENDER = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
] as const;

export const INTERESSEN = [
  "Handwerk",
  "Jobs",
  "Ausbildung",
  "Karriere",
  "Weiterbildung",
  "Bauwesen",
  "Elektrotechnik",
  "Sanitär / Heizung / Klima",
];

/** Berufe für Targeting-Suche — aus dem Fachkatalog des Matchings. */
export const BERUFE_OPTIONS: { value: string; label: string }[] = [
  ...new Map(
    BEREICHE.flatMap((b) => b.berufe.map((o) => [o.value, o.label] as const)),
  ),
].map(([value, label]) => ({ value, label }));
