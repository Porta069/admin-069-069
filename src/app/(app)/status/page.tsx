import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { cn } from "@/lib/utils";
import {
  Database,
  Globe,
  LayoutDashboard,
  Mail,
  Server,
  ServerCog,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { RefreshButton } from "./_components/refresh-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Systemstatus" };

type Zustand = "up" | "slow" | "down" | "unknown";
interface Check {
  status: Zustand;
  ms: number;
  detail: string;
}

/** HTTP-Erreichbarkeit prüfen (jede Antwort = erreichbar; 5xx/Timeout = down). */
async function pruefeHttp(
  url: string,
  opts?: { timeoutMs?: number; slowMs?: number; headers?: Record<string, string> },
): Promise<Check> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 6000),
      headers: opts?.headers,
      cache: "no-store",
    });
    const ms = Date.now() - t0;
    if (res.status >= 500) return { status: "down", ms, detail: `HTTP ${res.status}` };
    if (res.status === 401 || res.status === 403)
      return { status: "up", ms, detail: `erreichbar (HTTP ${res.status})` };
    const slow = ms > (opts?.slowMs ?? 2500);
    return { status: slow ? "slow" : "up", ms, detail: `HTTP ${res.status}` };
  } catch (e) {
    const ms = Date.now() - t0;
    const to = String((e as Error)?.name).includes("Timeout") || String((e as Error)?.name).includes("Abort");
    return { status: "down", ms, detail: to ? "Zeitüberschreitung" : "nicht erreichbar" };
  }
}

async function pruefeDb(): Promise<Check> {
  const t0 = Date.now();
  try {
    await sql`select 1`;
    const ms = Date.now() - t0;
    return { status: ms > 1500 ? "slow" : "up", ms, detail: "Abfrage erfolgreich" };
  } catch {
    return { status: "down", ms: Date.now() - t0, detail: "Abfrage fehlgeschlagen" };
  }
}

async function pruefeKi(): Promise<Check> {
  const key = process.env.ANTHROPIC_API_KEY;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!key && !token) return { status: "unknown", ms: 0, detail: "nicht konfiguriert" };
  const headers: Record<string, string> = { "anthropic-version": "2023-06-01" };
  if (key) headers["x-api-key"] = key;
  else headers["authorization"] = `Bearer ${token}`;
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers,
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    const ms = Date.now() - t0;
    if (res.ok) return { status: ms > 2500 ? "slow" : "up", ms, detail: "Schlüssel gültig" };
    if (res.status === 401 || res.status === 403)
      return { status: "down", ms, detail: "Schlüssel ungültig" };
    return { status: "down", ms, detail: `HTTP ${res.status}` };
  } catch (e) {
    const ms = Date.now() - t0;
    const to = String((e as Error)?.name).includes("Timeout");
    return { status: "down", ms, detail: to ? "Zeitüberschreitung" : "nicht erreichbar" };
  }
}

const ZUSTAND: Record<Zustand, { label: string; dot: string; text: string; ring: string }> = {
  up: { label: "Betriebsbereit", dot: "bg-success", text: "text-success", ring: "bg-success/10" },
  slow: { label: "Langsam", dot: "bg-warning", text: "text-warning", ring: "bg-warning/10" },
  down: { label: "Ausfall", dot: "bg-destructive", text: "text-destructive", ring: "bg-destructive/10" },
  unknown: { label: "Nicht konfiguriert", dot: "bg-muted-foreground/40", text: "text-muted-foreground", ring: "bg-muted" },
};

export default async function StatusPage() {
  await requireEmployee();

  const supaUrl = process.env.SUPABASE_URL;
  const backendUrl =
    process.env.BACKEND_URL ?? "https://portbackend-069-069.onrender.com/api/v1";
  const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://portawerk.de";

  const [db, supa, render, site, ki] = await Promise.all([
    pruefeDb(),
    supaUrl
      ? pruefeHttp(`${supaUrl}/auth/v1/health`, {
          timeoutMs: 6000,
          headers: process.env.SUPABASE_SERVICE_KEY
            ? { apikey: process.env.SUPABASE_SERVICE_KEY }
            : undefined,
        })
      : Promise.resolve<Check>({ status: "unknown", ms: 0, detail: "SUPABASE_URL fehlt" }),
    pruefeHttp(backendUrl, { timeoutMs: 12000, slowMs: 3000 }),
    pruefeHttp(siteUrl, { timeoutMs: 8000 }),
    pruefeKi(),
  ]);

  const dienste: {
    name: string;
    kategorie: string;
    icon: LucideIcon;
    check: Check;
    note: string;
  }[] = [
    { name: "Datenbank (Supabase)", kategorie: "Daten", icon: Database, check: db, note: "PostgreSQL — Kernspeicher aller Daten" },
    { name: "Supabase API / Auth", kategorie: "Daten", icon: ServerCog, check: supa, note: "Auth- & Storage-Endpunkt" },
    { name: "Backend (Render)", kategorie: "Dienste", icon: Server, check: render, note: "Plattform-/Prämien-Logik (Kaltstart möglich)" },
    { name: "Website / Domain (IONOS)", kategorie: "Web", icon: Globe, check: site, note: siteUrl.replace(/^https?:\/\//, "") },
    { name: "KI (Anthropic)", kategorie: "KI", icon: Sparkles, check: ki, note: "Anruf- & Assistenz-Funktionen" },
    {
      name: "Admin-Dashboard (Vercel)",
      kategorie: "Web",
      icon: LayoutDashboard,
      check: { status: "up", ms: 0, detail: "diese Seite läuft" },
      note: "dieses Dashboard",
    },
    {
      name: "E-Mail (Resend)",
      kategorie: "Dienste",
      icon: Mail,
      check: {
        status: process.env.RESEND_API_KEY ? "up" : "unknown",
        ms: 0,
        detail: process.env.RESEND_API_KEY ? "konfiguriert" : "nicht konfiguriert (Versand folgt)",
      },
      note: "ausgehender E-Mail-Versand",
    },
  ];

  const probleme = dienste.filter((d) => d.check.status === "down").length;
  const langsam = dienste.filter((d) => d.check.status === "slow").length;
  const geprueft = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(new Date());

  const kategorien: string[] = [];
  for (const d of dienste) if (!kategorien.includes(d.kategorie)) kategorien.push(d.kategorie);

  return (
    <>
      <PageHeader
        title="Systemstatus"
        description="Live-Erreichbarkeit aller genutzten Dienste."
        actions={<RefreshButton />}
      />

      {/* Gesamtstatus */}
      <div
        className={cn(
          "mb-6 flex flex-wrap items-center gap-3 rounded-lg border p-4",
          probleme > 0
            ? "border-destructive/30 bg-destructive/5"
            : langsam > 0
              ? "border-warning/30 bg-warning-soft"
              : "border-success/30 bg-success-soft",
        )}
      >
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full",
            probleme > 0 ? "bg-destructive/15" : langsam > 0 ? "bg-warning/15" : "bg-success/15",
          )}
        >
          <span
            className={cn(
              "size-3 rounded-full",
              probleme > 0 ? "bg-destructive" : langsam > 0 ? "bg-warning" : "bg-success",
            )}
          />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold">
            {probleme > 0
              ? `${probleme} Dienst${probleme > 1 ? "e" : ""} mit Ausfall`
              : langsam > 0
                ? `Alles erreichbar — ${langsam} Dienst${langsam > 1 ? "e" : ""} langsam`
                : "Alle Systeme betriebsbereit"}
          </p>
          <p className="text-xs text-muted-foreground">Zuletzt geprüft: {geprueft} Uhr</p>
        </div>
      </div>

      {kategorien.map((kat) => (
        <section key={kat} className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{kat}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dienste
              .filter((d) => d.kategorie === kat)
              .map((d) => {
                const z = ZUSTAND[d.check.status];
                const Icon = d.icon;
                return (
                  <div key={d.name} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("flex size-9 items-center justify-center rounded-lg", z.ring)}>
                        <Icon className={cn("size-4.5", z.text)} />
                      </span>
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", z.text)}>
                        <span className={cn("size-2 rounded-full", z.dot)} />
                        {z.label}
                      </span>
                    </div>
                    <p className="mt-3 font-medium">{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
                    <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                      <span>{d.check.detail}</span>
                      {d.check.ms > 0 && <span className="tabular">{d.check.ms} ms</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Prüfung erfolgt live bei jedem Laden dieser Seite. „Betriebsbereit" heißt
        erreichbar; ein langsames Render-Backend deutet meist auf einen Kaltstart hin.
      </p>
    </>
  );
}
