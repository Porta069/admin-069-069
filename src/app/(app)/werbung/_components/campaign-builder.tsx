"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Rocket, Search, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatEuroCents, formatNumber } from "@/lib/format";
import {
  PLATFORMS, ZIELE, CTAS, TRACKING_EVENTS, LAENDER, INTERESSEN,
  combinedCaps, platformLabel, type PlatformDef,
} from "@/lib/ads/platforms";
import { saveCampaign, type CampaignInput } from "../actions";

interface Creative { id: string; name: string; typ: string; url: string | null; aspect_ratio: string | null }

const STEPS = [
  "Plattform", "Ziel", "Budget", "Zielgruppe", "Anzeige", "Tracking", "Übersicht",
];

export interface CampaignBuilderInitial {
  id: string;
  name: string;
  platforms: string[];
  ziel: string;
  dailyEuro: number;
  tage: number;
  startDate: string;
  targeting: Partial<{
    laender: string[]; regionen: string; staedte: string; radiusKm: number;
    ageMin: number; ageMax: number; gender: string;
    interessen: string[]; berufe: string[]; audiences: string[];
  }>;
  creativeId: string;
  primaertext: string;
  ueberschrift: string;
  beschreibung: string;
  cta: string;
  landingUrl: string;
  tracking: Partial<{
    events: Record<string, boolean>;
    metaPixel: boolean; metaCapi: boolean; snapPixel: boolean; snapCapi: boolean;
  }>;
}

export function CampaignBuilder({
  connectedPlatforms,
  berufeOptions,
  creatives,
  defaultLanding,
  initial,
}: {
  connectedPlatforms: string[];
  berufeOptions: { value: string; label: string }[];
  creatives: Creative[];
  defaultLanding: string;
  /** Gesetzt = Bearbeiten einer bestehenden Kampagne statt Neuanlage. */
  initial?: CampaignBuilderInitial;
}) {
  const isEdit = Boolean(initial);
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [pending, startTransition] = React.useTransition();

  // ── State ──────────────────────────────────────────────────────────────
  const [platforms, setPlatforms] = React.useState<string[]>(initial?.platforms ?? []);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [ziel, setZiel] = React.useState(initial?.ziel ?? "REGISTRATIONS");
  const [dailyEuro, setDailyEuro] = React.useState(initial?.dailyEuro ?? 25);
  const [tage, setTage] = React.useState(initial?.tage ?? 14);
  const [startDate, setStartDate] = React.useState(initial?.startDate ?? "");
  const [tg, setTg] = React.useState({
    laender: initial?.targeting?.laender ?? (["DE"] as string[]),
    regionen: initial?.targeting?.regionen ?? "",
    staedte: initial?.targeting?.staedte ?? "",
    radiusKm: initial?.targeting?.radiusKm ?? 0,
    ageMin: initial?.targeting?.ageMin ?? 18,
    ageMax: initial?.targeting?.ageMax ?? 60,
    gender: initial?.targeting?.gender ?? "all",
    interessen: initial?.targeting?.interessen ?? ([] as string[]),
    berufe: initial?.targeting?.berufe ?? ([] as string[]),
    audiences: initial?.targeting?.audiences ?? ([] as string[]),
  });
  const [creativeId, setCreativeId] = React.useState<string>(initial?.creativeId ?? "");
  const [primaertext, setPrimaertext] = React.useState(initial?.primaertext ?? "");
  const [ueberschrift, setUeberschrift] = React.useState(initial?.ueberschrift ?? "");
  const [beschreibung, setBeschreibung] = React.useState(initial?.beschreibung ?? "");
  const [cta, setCta] = React.useState(initial?.cta ?? "SIGN_UP");
  const [landingUrl, setLandingUrl] = React.useState(initial?.landingUrl ?? defaultLanding);
  const [tracking, setTracking] = React.useState({
    events: initial?.tracking?.events ?? (Object.fromEntries(TRACKING_EVENTS.map((e) => [e, true])) as Record<string, boolean>),
    metaPixel: initial?.tracking?.metaPixel ?? true,
    metaCapi: initial?.tracking?.metaCapi ?? true,
    snapPixel: initial?.tracking?.snapPixel ?? true,
    snapCapi: initial?.tracking?.snapCapi ?? true,
  });
  const [berufSuche, setBerufSuche] = React.useState("");

  const caps = React.useMemo(() => combinedCaps(platforms), [platforms]);
  const totalCents = Math.round(dailyEuro * tage * 100);
  const ctaLabel = CTAS.find((c) => c.value === cta)?.label ?? "";
  const selectedCreative = creatives.find((c) => c.id === creativeId);

  const togglePlatform = (id: string) =>
    setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleIn = (key: "interessen" | "berufe" | "audiences" | "laender", v: string) =>
    setTg((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));

  const berufeGefiltert = React.useMemo(() => {
    const q = berufSuche.trim().toLowerCase();
    const base = q ? berufeOptions.filter((b) => b.label.toLowerCase().includes(q)) : berufeOptions;
    return base.slice(0, 40);
  }, [berufSuche, berufeOptions]);

  // grobe Prognose (klar als Schätzung markiert)
  const prognose = React.useMemo(() => {
    const cpmLow = 400, cpmHigh = 900; // 4–9 € CPM
    const impLow = Math.round((totalCents / cpmHigh) * 1000);
    const impHigh = Math.round((totalCents / cpmLow) * 1000);
    const ctr = 0.012;
    const conv = 0.06;
    const regLow = Math.round(impLow * ctr * conv);
    const regHigh = Math.round(impHigh * ctr * conv);
    return { impLow, impHigh, regLow, regHigh };
  }, [totalCents]);

  const canNext = () => {
    if (step === 0) return platforms.length > 0 && name.trim().length > 1;
    if (step === 2) return dailyEuro > 0 && tage > 0;
    return true;
  };

  const buildInput = (): CampaignInput => ({
    id: initial?.id ?? null,
    name,
    platforms,
    ziel,
    dailyBudgetCents: Math.round(dailyEuro * 100),
    totalBudgetCents: totalCents,
    startDate: startDate || null,
    endDate: null,
    targeting: { ...tg },
    creativeId: creativeId || null,
    primaertext: primaertext || null,
    ueberschrift: ueberschrift || null,
    beschreibung: beschreibung || null,
    cta,
    landingUrl: landingUrl || null,
    tracking,
  });

  const speichern = () =>
    startTransition(async () => {
      const r = await saveCampaign(buildInput()).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok && "id" in r) {
        toast.success(r.message ?? (isEdit ? "Kampagne gespeichert." : "Kampagne als Entwurf gespeichert."));
        router.push(`/werbung/kampagnen/${r.id}`);
      } else toast.error(r.message ?? "Fehlgeschlagen.");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Stepper */}
      <ol className="hidden gap-1 lg:flex lg:flex-col">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => (isEdit || i < step) && setStep(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                i === step ? "bg-primary/10 font-medium text-primary"
                  : i < step ? "text-foreground hover:bg-muted" : "text-muted-foreground",
              )}
            >
              <span className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                i === step ? "border-primary bg-primary text-primary-foreground"
                  : i < step ? "border-success bg-success text-white" : "border-border",
              )}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
            Schritt {step + 1}/7 · {STEPS[step]}
          </p>

          {/* 1 · Plattform */}
          {step === 0 && (
            <Section title="Plattform wählen" desc="Wo soll die Kampagne laufen? Mehrfachauswahl möglich.">
              <div className="space-y-1.5">
                <Label htmlFor="k-name">Kampagnenname</Label>
                <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Elektriker-Recruiting März" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {PLATFORMS.map((p) => (
                  <PlatformCard
                    key={p.id} p={p}
                    active={platforms.includes(p.id)}
                    connected={connectedPlatforms.includes(p.id)}
                    onClick={() => togglePlatform(p.id)}
                  />
                ))}
              </div>
              {platforms.some((p) => !connectedPlatforms.includes(p)) && (
                <p className="mt-3 text-xs text-warning">
                  Hinweis: Mindestens eine gewählte Plattform ist noch nicht verbunden. Du kannst die Kampagne
                  trotzdem als Entwurf vorbereiten — veröffentlicht wird erst nach dem Verbinden.
                </p>
              )}
            </Section>
          )}

          {/* 2 · Ziel */}
          {step === 1 && (
            <Section title="Kampagnenziel" desc="Worauf soll optimiert werden?">
              <div className="grid gap-2 sm:grid-cols-2">
                {ZIELE.map((z) => (
                  <button
                    key={z.value} type="button" onClick={() => setZiel(z.value)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                      ziel === z.value ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <span className="font-medium">{z.label}</span>
                    {"empfohlen" in z && z.empfohlen && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">empfohlen</span>
                    )}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* 3 · Budget */}
          {step === 2 && (
            <Section title="Budget & Laufzeit" desc="Das Gesamtbudget ergibt sich automatisch.">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="k-daily">Tagesbudget (€)</Label>
                  <Input id="k-daily" type="number" min={1} value={dailyEuro}
                    onChange={(e) => setDailyEuro(Math.max(0, Number(e.target.value)))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="k-tage">Laufzeit (Tage)</Label>
                  <Input id="k-tage" type="number" min={1} value={tage}
                    onChange={(e) => setTage(Math.max(1, Number(e.target.value)))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="k-start">Startdatum</Label>
                  <Input id="k-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gesamtbudget</p>
                <p className="font-display text-2xl font-semibold">{formatEuroCents(totalCents)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dailyEuro} € × {tage} Tage</p>
              </div>
              <div className="mt-3 rounded-lg border border-info/30 bg-info-soft/40 p-4">
                <p className="text-sm font-medium text-info">Grobe Prognose (nur Schätzung)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keine Garantie — echte Werte hängen von Zielgruppe, Creative und Plattform ab.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <Est label="Impressionen (ca.)" v={`${formatNumber(prognose.impLow)}–${formatNumber(prognose.impHigh)}`} />
                  <Est label="Registrierungen (ca.)" v={`${formatNumber(prognose.regLow)}–${formatNumber(prognose.regHigh)}`} />
                </div>
              </div>
            </Section>
          )}

          {/* 4 · Zielgruppe */}
          {step === 3 && (
            <Section title="Zielgruppe" desc="Es werden nur Optionen angezeigt, die die gewählten Plattformen unterstützen.">
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Länder</Label>
                  <div className="flex flex-wrap gap-2">
                    {LAENDER.map((l) => (
                      <Chip key={l.value} active={tg.laender.includes(l.value)} onClick={() => toggleIn("laender", l.value)}>
                        {l.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tg-regionen">Bundesländer / Regionen</Label>
                    <Input id="tg-regionen" value={tg.regionen} onChange={(e) => setTg((s) => ({ ...s, regionen: e.target.value }))} placeholder="z. B. Bayern, NRW" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tg-staedte">Städte</Label>
                    <Input id="tg-staedte" value={tg.staedte} onChange={(e) => setTg((s) => ({ ...s, staedte: e.target.value }))} placeholder="z. B. München, Köln" />
                  </div>
                </div>
                {caps.radiusTargeting && (
                  <div className="space-y-1.5">
                    <Label htmlFor="tg-radius">Umkreis (km, optional)</Label>
                    <Input id="tg-radius" type="number" min={0} value={tg.radiusKm} onChange={(e) => setTg((s) => ({ ...s, radiusKm: Number(e.target.value) }))} className="sm:w-40" />
                  </div>
                )}
                {caps.ageRange && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="tg-agemin">Alter von</Label>
                      <Input id="tg-agemin" type="number" min={13} max={65} value={tg.ageMin} onChange={(e) => setTg((s) => ({ ...s, ageMin: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tg-agemax">Alter bis</Label>
                      <Input id="tg-agemax" type="number" min={13} max={65} value={tg.ageMax} onChange={(e) => setTg((s) => ({ ...s, ageMax: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}
                {caps.gender && (
                  <div className="space-y-1.5">
                    <Label>Geschlecht</Label>
                    <Select value={tg.gender} onValueChange={(v) => setTg((s) => ({ ...s, gender: v }))}>
                      <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        <SelectItem value="male">Männlich</SelectItem>
                        <SelectItem value="female">Weiblich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {caps.interests && (
                  <div>
                    <Label className="mb-1.5 block">Interessen</Label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESSEN.map((i) => (
                        <Chip key={i} active={tg.interessen.includes(i)} onClick={() => toggleIn("interessen", i)}>{i}</Chip>
                      ))}
                    </div>
                  </div>
                )}
                {caps.berufe ? (
                  <div>
                    <Label className="mb-1.5 block">Berufe</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input value={berufSuche} onChange={(e) => setBerufSuche(e.target.value)} placeholder="Beruf suchen…" className="pl-8" />
                    </div>
                    {tg.berufe.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tg.berufe.map((b) => {
                          const lbl = berufeOptions.find((o) => o.value === b)?.label ?? b;
                          return <Chip key={b} active onClick={() => toggleIn("berufe", b)}>{lbl} ✕</Chip>;
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-2">
                      {berufeGefiltert.map((b) => (
                        <Chip key={b.value} active={tg.berufe.includes(b.value)} onClick={() => toggleIn("berufe", b.value)}>{b.label}</Chip>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Berufe-Targeting wird von der gewählten Plattform (Snapchat) nicht unterstützt und daher ausgeblendet.
                  </p>
                )}
                <div>
                  <Label className="mb-1.5 block">Weitere Zielgruppen</Label>
                  <div className="flex flex-wrap gap-2">
                    {caps.registeredUsers && <Chip active={tg.audiences.includes("registered")} onClick={() => toggleIn("audiences", "registered")}>Registrierte Nutzer</Chip>}
                    {caps.websiteVisitors && <Chip active={tg.audiences.includes("website")} onClick={() => toggleIn("audiences", "website")}>Website-Besucher</Chip>}
                    {caps.customAudiences && <Chip active={tg.audiences.includes("custom")} onClick={() => toggleIn("audiences", "custom")}>Custom Audience</Chip>}
                    {caps.lookalike && <Chip active={tg.audiences.includes("lookalike")} onClick={() => toggleIn("audiences", "lookalike")}>Lookalike</Chip>}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* 5 · Anzeige */}
          {step === 4 && (
            <Section title="Anzeige gestalten" desc="Creative, Texte und Ziel-URL. Rechts die Live-Vorschau.">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Creative</Label>
                    <Select value={creativeId || "none"} onValueChange={(v) => setCreativeId(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Creative wählen" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Creative (später)</SelectItem>
                        {creatives.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} · {c.typ}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Empfohlenes Format: 9:16 (Hochkant). Creatives verwaltest du unter „Creatives“.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a-prim">Primärtext</Label>
                    <Textarea id="a-prim" rows={3} value={primaertext} onChange={(e) => setPrimaertext(e.target.value)} placeholder="Dein Handwerk verdient den richtigen Job…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a-head">Überschrift</Label>
                    <Input id="a-head" value={ueberschrift} onChange={(e) => setUeberschrift(e.target.value)} placeholder="Jetzt kostenlos registrieren" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a-desc">Beschreibung</Label>
                    <Input id="a-desc" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Call-to-Action</Label>
                      <Select value={cta} onValueChange={setCta}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CTAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="a-url">Landingpage-URL</Label>
                      <Input id="a-url" value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://…" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tracking-Parameter (utm_source/-medium/-campaign) sollen beim Veröffentlichen angehängt werden (in Vorbereitung).
                  </p>
                </div>
                {/* Live-Vorschau */}
                <div className="flex justify-center">
                  <div className="w-64 overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                      <div className="size-6 rounded-full bg-primary/20" />
                      <div>
                        <p className="text-xs font-semibold leading-none">Werkpair</p>
                        <p className="text-[10px] text-muted-foreground">Gesponsert</p>
                      </div>
                    </div>
                    {primaertext && <p className="px-3 py-2 text-xs">{primaertext}</p>}
                    <div className="relative flex aspect-[9/16] max-h-72 items-center justify-center bg-muted">
                      {selectedCreative?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedCreative.url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">9:16 Creative-Vorschau</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{ueberschrift || "Überschrift"}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{beschreibung || "werkpair.de"}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                        {ctaLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* 6 · Tracking */}
          {step === 5 && (
            <Section title="Tracking & Events" desc="Welche Conversion-Events sollen erfasst werden?">
              <div className="grid gap-2 sm:grid-cols-2">
                {TRACKING_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <input type="checkbox" checked={tracking.events[ev]} onChange={(e) => setTracking((s) => ({ ...s, events: { ...s.events, [ev]: e.target.checked } }))} className="size-4 accent-[var(--primary)]" />
                    {ev}
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <TrackToggle label="Meta Pixel" on={tracking.metaPixel} set={(v) => setTracking((s) => ({ ...s, metaPixel: v }))} />
                <TrackToggle label="Meta Conversions API (CAPI)" on={tracking.metaCapi} set={(v) => setTracking((s) => ({ ...s, metaCapi: v }))} />
                <TrackToggle label="Snapchat Pixel" on={tracking.snapPixel} set={(v) => setTracking((s) => ({ ...s, snapPixel: v }))} />
                <TrackToggle label="Snapchat CAPI" on={tracking.snapCapi} set={(v) => setTracking((s) => ({ ...s, snapCapi: v }))} />
              </div>
            </Section>
          )}

          {/* 7 · Übersicht */}
          {step === 6 && (
            <Section title="Zusammenfassung" desc="Prüfe alles vor dem Speichern. Veröffentlicht wird erst später bewusst.">
              <dl className="divide-y rounded-lg border text-sm">
                <Sum k="Kampagne" v={name || "—"} />
                <Sum k="Plattformen" v={platforms.map(platformLabel).join(", ") || "—"} />
                <Sum k="Ziel" v={ZIELE.find((z) => z.value === ziel)?.label ?? ziel} />
                <Sum k="Budget" v={`${formatEuroCents(totalCents)} (${dailyEuro} €/Tag × ${tage} Tage)`} />
                <Sum k="Start" v={startDate || "—"} />
                <Sum k="Länder" v={tg.laender.join(", ") || "—"} />
                <Sum k="Alter" v={`${tg.ageMin}–${tg.ageMax}`} />
                <Sum k="Berufe" v={tg.berufe.length ? `${tg.berufe.length} gewählt` : "—"} />
                <Sum k="CTA" v={ctaLabel} />
                <Sum k="Landingpage" v={landingUrl || "—"} />
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Mit „Als Entwurf speichern“ wird noch nichts geschaltet. Die Veröffentlichung erfolgt separat
                mit Budget-Bestätigung in der Kampagnenliste.
              </p>
            </Section>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Weiter <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={speichern} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isEdit ? "Änderungen speichern" : "Als Entwurf speichern"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {desc && <p className="mb-4 mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function PlatformCard({ p, active, connected, onClick }: { p: PlatformDef; active: boolean; connected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted",
      )}
    >
      <span className="text-2xl">{p.icon}</span>
      <span className="text-sm font-medium">{p.label}</span>
      <span className={cn("text-[11px]", connected ? "text-success" : "text-muted-foreground")}>
        {connected ? "Verbunden" : "Noch nicht verbunden"}
      </span>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Est({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}

function TrackToggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
      {label}
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="size-4 accent-[var(--primary)]" />
    </label>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
