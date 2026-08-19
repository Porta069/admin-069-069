"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  MapPin,
  RotateCcw,
  Save,
  Search,
  UserSquare2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  BEREICHE,
  AUSBILDUNGSSTATUS,
  ERFAHRUNG,
  MONTAGE,
  FUEHRERSCHEIN,
  DEUTSCH,
  START,
  PRIORITAETEN,
  PRIORITAETEN_MAX,
  findBereich,
  type KatalogOption,
} from "@/lib/matching/catalog";
import { sucheKandidaten, speichereAlsStelle } from "../actions";

type Kriterien = {
  bereich: string | null;
  ausbildungsstatus: string | null;
  beruf: string | null;
  aufgaben: string[];
  erfahrung: string | null;
  prioritaeten: string[];
  montage: string | null;
  fuehrerschein: string | null;
  deutsch: string | null;
  start: string | null;
};
type SuchKandidat = {
  applicationId: string;
  name: string;
  profession: string | null;
  federalState: string | null;
  score: number;
  ohneKriterien: boolean;
};
type SuchErgebnis = {
  bewertet: SuchKandidat[];
  ausgeschlossen: number;
  ohneProfil: number;
  gesamtGeprueft: number;
  kriterienGesetzt: boolean;
};

const LEER: Kriterien = {
  bereich: null,
  ausbildungsstatus: null,
  beruf: null,
  aufgaben: [],
  erfahrung: null,
  prioritaeten: [],
  montage: null,
  fuehrerschein: null,
  deutsch: null,
  start: null,
};
const EGAL = "__egal__";

function hatKriterien(k: Kriterien): boolean {
  return Boolean(
    k.bereich ||
      k.beruf ||
      k.aufgaben.length ||
      k.ausbildungsstatus ||
      k.erfahrung ||
      k.montage ||
      k.fuehrerschein ||
      k.deutsch ||
      k.start ||
      k.prioritaeten.length,
  );
}

export function KandidatenSuche({
  canSave,
  companies,
}: {
  canSave: boolean;
  companies: { id: string; name: string; ort: string | null }[];
}) {
  const [k, setK] = React.useState<Kriterien>(LEER);
  const [ergebnis, setErgebnis] = React.useState<SuchErgebnis | null>(null);
  const [loading, setLoading] = React.useState(false);
  const reqId = React.useRef(0);

  const bereich = k.bereich ? findBereich(k.bereich) : null;

  // Live-Suche (debounced)
  React.useEffect(() => {
    const id = ++reqId.current;
    if (!hatKriterien(k)) {
      setErgebnis(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await sucheKandidaten(k).catch(() => null);
      if (id !== reqId.current) return;
      setLoading(false);
      setErgebnis(r && r.ok ? r.ergebnis : null);
    }, 400);
    return () => clearTimeout(t);
  }, [k]);

  const setFeld = <F extends keyof Kriterien>(feld: F, wert: Kriterien[F]) =>
    setK((s) => ({ ...s, [feld]: wert }));

  const setBereich = (v: string | null) =>
    setK((s) => ({ ...s, bereich: v, beruf: null, aufgaben: [] }));

  const toggle = (feld: "aufgaben" | "prioritaeten", value: string, max?: number) =>
    setK((s) => {
      const has = s[feld].includes(value);
      if (has) return { ...s, [feld]: s[feld].filter((x) => x !== value) };
      if (max && s[feld].length >= max) return s;
      return { ...s, [feld]: [...s[feld], value] };
    });

  const einSelect = (
    label: string,
    feld: "ausbildungsstatus" | "erfahrung" | "montage" | "fuehrerschein" | "deutsch" | "start",
    optionen: KatalogOption[],
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={k[feld] ?? EGAL}
        onValueChange={(v) => setFeld(feld, v === EGAL ? null : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EGAL}>Egal</SelectItem>
          {optionen.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const chips = (
    optionen: KatalogOption[],
    ausgewaehlt: string[],
    feld: "aufgaben" | "prioritaeten",
    max?: number,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {optionen.map((o) => {
        const on = ausgewaehlt.includes(o.value);
        const voll = Boolean(max && !on && ausgewaehlt.length >= max);
        return (
          <button
            key={o.value}
            type="button"
            disabled={voll}
            onClick={() => toggle(feld, o.value, max)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-accent",
              voll && "cursor-not-allowed opacity-40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const treffer = ergebnis?.bewertet ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      {/* ── LINKS: Live-Ergebnisse ─────────────────────────────────── */}
      <section className="order-2 lg:order-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Search className="size-4 text-primary" />
            Passende Kandidaten
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </h2>
          {ergebnis && (
            <span className="text-xs text-muted-foreground">
              {treffer.length} Treffer · {ergebnis.ausgeschlossen} ausgeschlossen ·{" "}
              {ergebnis.ohneProfil} ohne Profil
            </span>
          )}
        </div>

        {!hatKriterien(k) ? (
          <EmptyState
            icon={Search}
            title="Kriterien wählen"
            description="Lege rechts die gewünschten Eigenschaften fest — die passenden Jobsuchenden erscheinen hier live, sortiert nach Übereinstimmung."
          />
        ) : treffer.length === 0 && !loading ? (
          <EmptyState
            icon={UserSquare2}
            title="Keine passenden Kandidaten"
            description="Zu diesen Kriterien passt aktuell niemand aus der Kartei. Lockere die Anforderungen (z. B. Bereich oder Mindestwerte)."
          />
        ) : (
          <ul className="space-y-2">
            {treffer.map((c) => (
              <li key={c.applicationId} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "font-display w-12 shrink-0 text-xl font-semibold tabular",
                      c.ohneKriterien
                        ? "text-muted-foreground/50"
                        : c.score >= 80
                          ? "text-success"
                          : c.score >= 50
                            ? "text-foreground"
                            : "text-muted-foreground",
                    )}
                  >
                    {c.score}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/kandidaten/${c.applicationId}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                      {c.profession && <span>{c.profession}</span>}
                      {c.federalState && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {c.federalState}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.ohneKriterien && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      ohne bewertbare Kriterien
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── RECHTS: Kriterien-Formular ─────────────────────────────── */}
      <section className="order-1 space-y-4 rounded-lg border bg-card p-4 lg:order-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Kriterien</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setK(LEER)}
              disabled={!hatKriterien(k)}
            >
              <RotateCcw className="size-3.5" />
              Zurücksetzen
            </Button>
            {canSave && (
              <SpeichernDialog kriterien={k} companies={companies} disabled={!hatKriterien(k)} />
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Bereich</Label>
          <Select
            value={k.bereich ?? EGAL}
            onValueChange={(v) => setBereich(v === EGAL ? null : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Bereich wählen…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EGAL}>Egal</SelectItem>
              {BEREICHE.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {einSelect("Ausbildungsstand (min.)", "ausbildungsstatus", AUSBILDUNGSSTATUS)}
          <div className="space-y-1.5">
            <Label>Beruf</Label>
            <Select
              value={k.beruf ?? EGAL}
              onValueChange={(v) => setFeld("beruf", v === EGAL ? null : v)}
              disabled={!bereich}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={bereich ? "Egal" : "Erst Bereich wählen"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EGAL}>Egal</SelectItem>
                {bereich?.berufe.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Aufgabenbereiche{" "}
            <span className="font-normal text-muted-foreground">(Erfahrung in)</span>
          </Label>
          {bereich ? (
            chips(bereich.aufgaben, k.aufgaben, "aufgaben")
          ) : (
            <p className="text-xs text-muted-foreground">Erst einen Bereich wählen.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {einSelect("Erfahrung (min.)", "erfahrung", ERFAHRUNG)}
          {einSelect("Montagebereitschaft (min.)", "montage", MONTAGE)}
          {einSelect("Führerschein (min.)", "fuehrerschein", FUEHRERSCHEIN)}
          {einSelect("Deutsch (min.)", "deutsch", DEUTSCH)}
          {einSelect("Frühester Start bis", "start", START)}
        </div>

        <div className="space-y-1.5">
          <Label>
            Gebotenes{" "}
            <span className="font-normal text-muted-foreground">
              (max. {PRIORITAETEN_MAX})
            </span>
          </Label>
          {chips(PRIORITAETEN, k.prioritaeten, "prioritaeten", PRIORITAETEN_MAX)}
        </div>

        <p className="text-xs text-muted-foreground">
          Gewichtung wie in der Matching-Engine: Aufgaben (5) · Erfahrung (4) · Beruf
          (3) · Gebotenes (2) · Führerschein (2) · Start (1). Bereich, Ausbildung,
          Montage und Deutsch sind Ausschlusskriterien. Der Arbeitsort wird hier
          nicht geprüft.
        </p>
      </section>
    </div>
  );
}

function SpeichernDialog({
  kriterien,
  companies,
  disabled,
}: {
  kriterien: Kriterien;
  companies: { id: string; name: string; ort: string | null }[];
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const speichern = () =>
    startTransition(async () => {
      const r = await speichereAlsStelle(kriterien, companyId, title).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (r.ok) {
        toast.success(r.message ?? "Stelle gespeichert.");
        setOpen(false);
        setTitle("");
        setCompanyId("");
      } else {
        toast.error(r.message);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Save className="size-3.5" />
          Als Stelle speichern
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Als Stellenanzeige speichern</DialogTitle>
          <DialogDescription>
            Die aktuellen Kriterien werden als Stelle gespeichert und einem Unternehmen
            zugeordnet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stelle-titel">Titel der Stelle</Label>
            <Input
              id="stelle-titel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Elektroniker Energie- & Gebäudetechnik (m/w/d)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unternehmen</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unternehmen wählen…" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {c.name}
                      {c.ort && (
                        <span className="text-muted-foreground">· {c.ort}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={speichern}
            disabled={pending || !title.trim() || !companyId}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
