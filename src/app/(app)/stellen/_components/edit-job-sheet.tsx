"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AUSBILDUNG_OPTIONS,
  BEREICH_OPTIONS,
  BERUF_LABELS,
  DEUTSCH_OPTIONS,
  ERFAHRUNG_OPTIONS,
  FUEHRERSCHEIN_OPTIONS,
  MONTAGE_MIN_OPTIONS,
  MONTAGE_TEXT_OPTIONS,
  PRIORITAETEN_OPTIONS,
  START_OPTIONS,
  STANDARD_GEWICHTE,
  WEIGHT_CRITERIA,
  WEIGHT_MAX,
  type KriteriumKey,
  type LevelOption,
  aufgabenOptionsFuer,
  bereichLabel,
  berufLabel,
  humanizeSlug,
  weightLabel,
} from "../_lib/job-criteria";
import type { ActionResult, UpdateJobPayload } from "../actions";
import type { Bereich } from "@/lib/matching/catalog";

const NONE = "__none__";

const STATUS_OPTIONS: LevelOption[] = [
  { value: "DRAFT", label: "Entwurf" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "PAUSED", label: "Pausiert" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const BERUF_SUGGESTIONS: LevelOption[] = Object.entries(BERUF_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/* ── Bausteine ─────────────────────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** Chips mit X + Textfeld+Enter (mit Katalog-Vorschlägen per datalist). */
function TagInput({
  id,
  value,
  onChange,
  suggestions,
  labelOf,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: LevelOption[];
  labelOf: (slug: string) => string;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    // Eingabe eines Katalog-Labels auf den Slug zurückführen.
    const bySlug = suggestions.find(
      (s) =>
        s.value === trimmed || s.label.toLowerCase() === trimmed.toLowerCase(),
    );
    const next = bySlug ? bySlug.value : trimmed;
    if (!value.includes(next)) onChange([...value, next]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs font-medium text-secondary-foreground"
            >
              {labelOf(slug)}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== slug))}
                className="rounded-full p-0.5 hover:bg-foreground/10"
                aria-label={`${labelOf(slug)} entfernen`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        list={`${id}-list`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={placeholder}
      />
      <datalist id={`${id}-list`}>
        {suggestions.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </datalist>
      <p className="text-xs text-muted-foreground">
        Mit Enter hinzufügen — Vorschläge kommen aus dem Plattform-Katalog.
      </p>
    </div>
  );
}

/** Select für Mindest-Level mit „Keine Anforderung"-Option. */
function LevelSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  options: LevelOption[];
}) {
  const known = value == null || options.some((o) => o.value === value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Keine Anforderung</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {!known && value != null && (
            <SelectItem value={value}>{humanizeSlug(value)}</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── Haupt-Komponente ──────────────────────────────────────────────────── */

export function EditJobSheet({
  jobId,
  initial,
  action,
  triggerLabel = "Bearbeiten",
  triggerVariant = "outline",
  katalogBereiche,
  katalogQuelle = "fallback",
}: {
  jobId: string;
  initial: UpdateJobPayload;
  action: (id: string, payload: UpdateJobPayload) => Promise<ActionResult>;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default" | "secondary";
  /** Live-Katalog vom Backend; fehlt er, greift die lokale Rückfallebene. */
  katalogBereiche?: Bereich[];
  katalogQuelle?: "live" | "fallback";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<UpdateJobPayload>(initial);
  const [weights, setWeights] = React.useState<{ key: string; value: number }[]>(
    () => Object.entries(initial.gewichte).map(([key, value]) => ({ key, value })),
  );
  const [pending, startTransition] = React.useTransition();

  // Formular beim Öffnen auf den Serverstand zurücksetzen.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setForm(initial);
      setWeights(
        Object.entries(initial.gewichte).map(([key, value]) => ({ key, value })),
      );
    }
  };

  const set = <K extends keyof UpdateJobPayload>(
    key: K,
    value: UpdateJobPayload[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const setNum = (key: "salaryMin" | "salaryMax" | "urlaubstage", raw: string) =>
    set(key, raw === "" ? null : Number(raw));

  const usedWeightKeys = new Set(weights.map((w) => w.key));
  const addableWeights = WEIGHT_CRITERIA.filter((c) => !usedWeightKeys.has(c.value));
  // Live-Katalog bevorzugen; die statische Liste ist nur Rückfallebene.
  const bereichOptionen: LevelOption[] = katalogBereiche
    ? katalogBereiche.map((b) => ({ value: b.value, label: b.label }))
    : BEREICH_OPTIONS;
  const berufVorschlaege: LevelOption[] = katalogBereiche
    ? katalogBereiche.flatMap((b) =>
        b.berufe.map((x) => ({ value: x.value, label: x.label })),
      )
    : BERUF_SUGGESTIONS;
  // Aufgaben hängen an den gewählten Bereichen — Auswahl folgt live dem Formular.
  const aufgabenAuswahl = aufgabenOptionsFuer(form.bereiche, katalogBereiche);

  const salaryInvalid =
    form.salaryMin != null &&
    form.salaryMax != null &&
    form.salaryMin > form.salaryMax;

  const submit = () =>
    startTransition(async () => {
      const payload: UpdateJobPayload = {
        ...form,
        gewichte: Object.fromEntries(weights.map((w) => [w.key, w.value])),
      };
      const result = await action(jobId, payload).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Gespeichert.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Speichern fehlgeschlagen.");
      }
    });

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant={triggerVariant} size="sm" className="bg-card">
          <Pencil className="size-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl lg:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Stellenanzeige bearbeiten</SheetTitle>
          <SheetDescription>
            Änderungen wirken direkt auf die Plattform-Stelle und damit aufs
            Matching. Jede Änderung wird im Audit-Log protokolliert.
            {katalogQuelle === "fallback" &&
              " · Fachkatalog gerade nicht erreichbar — lokale Kopie aktiv."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          {/* ── Basis ── */}
          <Group title="Basis">
            <div className="space-y-2">
              <Label htmlFor="job-title">Titel</Label>
              <Input
                id="job-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-city">Ort</Label>
                <Input
                  id="job-city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-desc">Beschreibung</Label>
              <Textarea
                id="job-desc"
                rows={4}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </Group>

          {/* ── Konditionen ── */}
          <Group title="Konditionen">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="job-salary-min">Gehalt min. (€/Monat)</Label>
                <Input
                  id="job-salary-min"
                  type="number"
                  min={0}
                  value={form.salaryMin ?? ""}
                  onChange={(e) => setNum("salaryMin", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-salary-max">Gehalt max. (€/Monat)</Label>
                <Input
                  id="job-salary-max"
                  type="number"
                  min={0}
                  value={form.salaryMax ?? ""}
                  onChange={(e) => setNum("salaryMax", e.target.value)}
                />
              </div>
            </div>
            {salaryInvalid && (
              <p className="text-xs text-destructive">
                Das Mindestgehalt liegt über dem Maximalgehalt.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="job-urlaub">Urlaubstage</Label>
                <Input
                  id="job-urlaub"
                  type="number"
                  min={0}
                  value={form.urlaubstage ?? ""}
                  onChange={(e) => setNum("urlaubstage", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Montage</Label>
                <Select
                  value={form.montage}
                  onValueChange={(v) => set("montage", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTAGE_TEXT_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                    {!MONTAGE_TEXT_OPTIONS.includes(form.montage) &&
                      form.montage && (
                        <SelectItem value={form.montage}>
                          {form.montage}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Group>

          {/* ── Anforderungen fürs Matching ── */}
          <Group title="Anforderungen fürs Matching">
            <div className="space-y-2">
              <Label htmlFor="job-gewerk">Gewerk</Label>
              <Input
                id="job-gewerk"
                value={form.gewerk}
                onChange={(e) => set("gewerk", e.target.value)}
                placeholder="z. B. Elektriker / Elektroniker"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-berufe">Berufe</Label>
              <TagInput
                id="job-berufe"
                value={form.berufe}
                onChange={(v) => set("berufe", v)}
                suggestions={berufVorschlaege}
                labelOf={berufLabel}
                placeholder="Beruf tippen und mit Enter hinzufügen…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-bereiche">Bereiche</Label>
              <TagInput
                id="job-bereiche"
                value={form.bereiche}
                onChange={(v) => set("bereiche", v)}
                suggestions={bereichOptionen}
                labelOf={bereichLabel}
                placeholder="Bereich tippen und mit Enter hinzufügen…"
              />
            </div>
            {/* Aufgabenbereiche — wichtigstes Kriterium (Gewicht 5) */}
            <div className="space-y-2 rounded-md border border-primary/25 bg-accent/40 p-3">
              <Label>
                Aufgabenbereiche{" "}
                <span className="font-normal text-muted-foreground">
                  — wichtigstes Matching-Kriterium (Gewicht 5)
                </span>
              </Label>
              {aufgabenAuswahl.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Zuerst oben mindestens einen Bereich wählen — jeder Bereich
                  bringt seine eigenen Aufgabenbereiche mit.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {aufgabenAuswahl.map((o) => {
                    const aktiv = form.aufgaben.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() =>
                          set(
                            "aufgaben",
                            aktiv
                              ? form.aufgaben.filter((a) => a !== o.value)
                              : [...form.aufgaben, o.value],
                          )
                        }
                        className={
                          aktiv
                            ? "rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                            : "rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/50"
                        }
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Label htmlFor="job-aufgaben-min" className="shrink-0 text-xs">
                  Mindestabdeckung
                </Label>
                <Input
                  id="job-aufgaben-min"
                  type="number"
                  min={0}
                  max={form.aufgaben.length}
                  value={form.aufgabenMin ?? 0}
                  onChange={(e) =>
                    set(
                      "aufgabenMin",
                      Math.max(0, Math.min(form.aufgaben.length, Number(e.target.value) || 0)),
                    )
                  }
                  className="w-20 text-right tabular"
                />
                <p className="text-xs text-muted-foreground">
                  {(form.aufgabenMin ?? 0) > 0
                    ? "⚠ Schließt Bewerber HART aus, die weniger Bereiche abdecken."
                    : "0 = fließt nur in die Punktwertung ein (empfohlen)."}
                </p>
              </div>
            </div>

            {/* Gebotenes — schaltet das Prioritäten-Kriterium frei */}
            <div className="space-y-2">
              <Label>
                Was der Betrieb bietet{" "}
                <span className="font-normal text-muted-foreground">
                  — nur wenn hier etwas hinterlegt ist, wird „Prioritäten" gewertet
                </span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITAETEN_OPTIONS.map((o) => {
                  const aktiv = form.gebotenes.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        set(
                          "gebotenes",
                          aktiv
                            ? form.gebotenes.filter((g) => g !== o.value)
                            : [...form.gebotenes, o.value],
                        )
                      }
                      className={
                        aktiv
                          ? "rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                          : "rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/50"
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <LevelSelect
                label="Besetzen bis (Start)"
                value={form.startBis}
                onChange={(v) => set("startBis", v)}
                options={START_OPTIONS}
              />
              <LevelSelect
                label="Erfahrung mind."
                value={form.erfahrungMin}
                onChange={(v) => set("erfahrungMin", v)}
                options={ERFAHRUNG_OPTIONS}
              />
              <LevelSelect
                label="Erfahrung max."
                value={form.erfahrungMax}
                onChange={(v) => set("erfahrungMax", v)}
                options={ERFAHRUNG_OPTIONS}
              />
              <LevelSelect
                label="Ausbildung mind."
                value={form.ausbildungMin}
                onChange={(v) => set("ausbildungMin", v)}
                options={AUSBILDUNG_OPTIONS}
              />
              <LevelSelect
                label="Deutsch mind."
                value={form.deutschMin}
                onChange={(v) => set("deutschMin", v)}
                options={DEUTSCH_OPTIONS}
              />
              <LevelSelect
                label="Führerschein mind."
                value={form.fuehrerscheinMin}
                onChange={(v) => set("fuehrerscheinMin", v)}
                options={FUEHRERSCHEIN_OPTIONS}
              />
              <LevelSelect
                label="Montagebereitschaft mind."
                value={form.montageMin}
                onChange={(v) => set("montageMin", v)}
                options={MONTAGE_MIN_OPTIONS}
              />
            </div>
          </Group>

          {/* ── Gewichtungen ── */}
          <Group title="Gewichtungen (0–5, Vorgaben der Engine als Startwert)">
            {weights.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Gewichte hinterlegt — Kriterium unten hinzufügen.
              </p>
            )}
            {weights.map((w, idx) => (
              <div key={w.key} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">
                  {weightLabel(w.key)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={WEIGHT_MAX}
                  value={w.value}
                  onChange={(e) =>
                    setWeights((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, value: Number(e.target.value) } : p,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 accent-primary"
                  aria-label={`Gewicht ${weightLabel(w.key)}`}
                />
                <Input
                  type="number"
                  min={0}
                  max={WEIGHT_MAX}
                  value={w.value}
                  onChange={(e) =>
                    setWeights((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              value: Math.max(
                                0,
                                Math.min(WEIGHT_MAX, Number(e.target.value) || 0),
                              ),
                            }
                          : p,
                      ),
                    )
                  }
                  className="w-18 text-right tabular"
                  aria-label={`Gewicht ${weightLabel(w.key)} (Zahl)`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setWeights((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label={`Gewicht ${weightLabel(w.key)} entfernen`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            {addableWeights.length > 0 && (
              <Select
                value=""
                onValueChange={(key) =>
                  setWeights((prev) => [
                    ...prev,
                    {
                      key,
                      value: STANDARD_GEWICHTE[key as KriteriumKey] ?? 3,
                    },
                  ])
                }
              >
                <SelectTrigger className="w-full">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Plus className="size-4" />
                    Kriterium hinzufügen…
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {addableWeights.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Group>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !form.title.trim() || salaryInvalid}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
