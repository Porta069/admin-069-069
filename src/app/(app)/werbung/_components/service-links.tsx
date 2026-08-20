import {
  ArrowUpRight, BarChart3, Building2, CreditCard, LayoutDashboard, Radio, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Provider } from "@/lib/ads/platforms";

/**
 * Marken-Schnellzugriff pro Werbe-Dienst — fancy Icon-Kacheln, die extern in den
 * jeweiligen Bereich (Ads Manager, Analysen, Business Manager, Abrechnung)
 * springen. Server-Komponente (reine Links); Deep-Links nutzen die Werbekonto-ID
 * aus der Env, wo die Plattform stabile URLs bietet.
 */

interface QuickLink {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

interface Brand {
  accent: string;
  chipBg: string;
  chipFg: string;
  glow: string;
}

const BRAND: Record<Provider, Brand> = {
  snapchat: { accent: "#caa300", chipBg: "#FFFC00", chipFg: "#0b0b0b", glow: "rgba(255,252,0,0.35)" },
  meta: { accent: "#0866FF", chipBg: "rgba(8,102,255,0.12)", chipFg: "#0866FF", glow: "rgba(8,102,255,0.28)" },
};

function snapLinks(): QuickLink[] {
  return [
    { label: "Ads Manager", hint: "Kampagnen verwalten", href: "https://ads.snapchat.com", icon: LayoutDashboard },
    { label: "Analysen", hint: "Reporting & Insights", href: "https://ads.snapchat.com/reporting", icon: BarChart3 },
    { label: "Business Manager", hint: "Konten & Assets", href: "https://business.snapchat.com", icon: Building2 },
    { label: "Abrechnung", hint: "Zahlungen & Rechnungen", href: "https://ads.snapchat.com/billing", icon: CreditCard },
  ];
}

function metaLinks(): QuickLink[] {
  const act = (process.env.META_AD_ACCOUNT_ID ?? "").replace(/^act_/, "");
  const adsManager = act
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${act}`
    : "https://adsmanager.facebook.com";
  return [
    { label: "Ads Manager", hint: "Kampagnen verwalten", href: adsManager, icon: LayoutDashboard },
    { label: "Analysen", hint: "Reporting", href: "https://www.facebook.com/adsmanager/reporting", icon: BarChart3 },
    { label: "Business Manager", hint: "Konten & Assets", href: "https://business.facebook.com", icon: Building2 },
    { label: "Events Manager", hint: "Pixel & CAPI", href: "https://business.facebook.com/events_manager2", icon: Radio },
    { label: "Zielgruppen", hint: "Audiences", href: "https://business.facebook.com/adsmanager/audiences", icon: Users },
    { label: "Abrechnung", hint: "Zahlungen & Rechnungen", href: "https://business.facebook.com/billing_hub/accounts", icon: CreditCard },
  ];
}

export function ServiceLinks({ provider }: { provider: Provider }) {
  const brand = BRAND[provider];
  const links = provider === "snapchat" ? snapLinks() : metaLinks();

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Schnellzugriff</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ["--accent" as string]: brand.accent, ["--glow" as string]: brand.glow }}
            className="group relative flex items-center gap-3 overflow-hidden rounded-lg border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:[border-color:var(--accent)] hover:shadow-[0_6px_20px_-8px_var(--glow)]"
          >
            {/* dezenter Marken-Schimmer beim Hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ background: `linear-gradient(90deg, transparent, ${brand.glow})` }}
            />
            <span
              className="relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
              style={{ backgroundColor: brand.chipBg, color: brand.chipFg }}
            >
              <l.icon className="size-4" />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight">{l.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{l.hint}</span>
            </span>
            <ArrowUpRight className="relative size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:[color:var(--accent)]" />
          </a>
        ))}
      </div>
    </div>
  );
}
