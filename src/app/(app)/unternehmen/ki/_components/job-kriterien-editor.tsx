"use client";

import type { KiJob } from "@/lib/ki-intake";
import {
  BEREICH_OPTIONS,
  AUSBILDUNG_OPTIONS,
  DEUTSCH_OPTIONS,
  ERFAHRUNG_OPTIONS,
  FUEHRERSCHEIN_OPTIONS,
  MONTAGE_MIN_OPTIONS,
  START_OPTIONS,
  PRIORITAETEN_OPTIONS,
  aufgabenOptionsFuer,
  berufeOptionsFuer,
  type LevelOption,
} from "../../../stellen/_lib/job-criteria";

/**
 * Vollständiger Matching-Kriterien-Editor für einen Job im KI-Review — deckt
 * genau die Felder ab, die der Handwerker bei der Registrierung angibt, sodass
 * jedes Kriterium hier gesetzt/korrigiert werden kann (nicht nur Gebotenes).
 */
export function JobKriterienEditor({
  job,
  onChange,
}: {
  job: KiJob;
  onChange: (patch: Partial<KiJob>) => void;
}) {
  const berufeAuswahl = berufeOptionsFuer(job.bereiche);
  const aufgabenAuswahl = aufgabenOptionsFuer(job.bereiche);

  const toggle = (key: "bereiche" | "berufe" | "aufgaben" | "gebotenes", value: string) => {
    const list = job[key];
    onChange({
      [key]: list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    } as Partial<KiJob>);
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed bg-accent/20 p-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Optimale Kandidaten-Kriterien · alle Registrierungsfelder
      </p>

      {/* Ausschluss: Ausbildungsbereich(e) */}
      <ChipGroup
        label="Ausbildungsbereich(e)"
        options={BEREICH_OPTIONS}
        selected={job.bereiche}
        onToggle={(v) => {
          // Bereich abwählen → nicht mehr passende Berufe/Aufgaben entfernen
          const next = job.bereiche.includes(v)
            ? job.bereiche.filter((x) => x !== v)
            : [...job.bereiche, v];
          const erlaubtBerufe = new Set(berufeOptionsFuer(next).map((o) => o.value));
          const erlaubtAufgaben = new Set(aufgabenOptionsFuer(next).map((o) => o.value));
          onChange({
            bereiche: next,
            berufe: job.berufe.filter((b) => erlaubtBerufe.has(b)),
            aufgaben: job.aufgaben.filter((a) => erlaubtAufgaben.has(a)),
          });
        }}
      />

      {job.bereiche.length > 0 && (
        <ChipGroup
          label="Bevorzugte Berufe"
          options={berufeAuswahl}
          selected={job.berufe}
          onToggle={(v) => toggle("berufe", v)}
          hint="fließt gewichtet ein"
        />
      )}

      {job.bereiche.length > 0 && (
        <div className="space-y-1.5">
          <ChipGroup
            label="Aufgabenbereiche"
            options={aufgabenAuswahl}
            selected={job.aufgaben}
            onToggle={(v) => {
              const next = job.aufgaben.includes(v)
                ? job.aufgaben.filter((x) => x !== v)
                : [...job.aufgaben, v];
              onChange({
                aufgaben: next,
                aufgabenMin: Math.min(job.aufgabenMin, next.length),
              });
            }}
            hint="wichtigstes Kriterium"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Mindestabdeckung</label>
            <input
              type="number"
              min={0}
              max={job.aufgaben.length}
              value={job.aufgabenMin}
              onChange={(e) =>
                onChange({
                  aufgabenMin: Math.max(0, Math.min(job.aufgaben.length, Number(e.target.value) || 0)),
                })
              }
              className="h-7 w-16 rounded-md border bg-card px-2 text-right text-xs tabular"
            />
            <span className="text-xs text-muted-foreground">
              {job.aufgabenMin > 0 ? "⚠ schließt Bewerber hart aus" : "0 = nur Punktwertung"}
            </span>
          </div>
        </div>
      )}

      {/* Skalen als Selects */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <LevelSelect label="Erfahrung ab" options={ERFAHRUNG_OPTIONS} value={job.erfahrungMin} onChange={(v) => onChange({ erfahrungMin: v })} />
        <LevelSelect label="Erfahrung bis" options={ERFAHRUNG_OPTIONS} value={job.erfahrungMax} onChange={(v) => onChange({ erfahrungMax: v })} />
        <LevelSelect label="Ausbildung mind." options={AUSBILDUNG_OPTIONS} value={job.ausbildungMin} onChange={(v) => onChange({ ausbildungMin: v })} />
        <LevelSelect label="Deutsch mind." options={DEUTSCH_OPTIONS} value={job.deutschMin} onChange={(v) => onChange({ deutschMin: v })} />
        <LevelSelect label="Führerschein mind." options={FUEHRERSCHEIN_OPTIONS} value={job.fuehrerscheinMin} onChange={(v) => onChange({ fuehrerscheinMin: v })} />
        <LevelSelect label="Montage mind." options={MONTAGE_MIN_OPTIONS} value={job.montageMin} onChange={(v) => onChange({ montageMin: v })} />
        <LevelSelect label="Besetzen bis" options={START_OPTIONS} value={job.startBis} onChange={(v) => onChange({ startBis: v })} />
      </div>

      {/* Gebotenes */}
      <ChipGroup
        label="Was der Betrieb bietet"
        options={PRIORITAETEN_OPTIONS}
        selected={job.gebotenes}
        onToggle={(v) => toggle("gebotenes", v)}
        hint="trifft auf die Wünsche des Handwerkers"
        tone="success"
      />
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  hint,
  tone = "primary",
}: {
  label: string;
  options: LevelOption[];
  selected: string[];
  onToggle: (value: string) => void;
  hint?: string;
  tone?: "primary" | "success";
}) {
  if (options.length === 0) return null;
  const aktivCls =
    tone === "success"
      ? "border-success bg-success-soft text-success"
      : "border-primary bg-primary text-primary-foreground";
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">— {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const aktiv = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={
                aktiv
                  ? `rounded-full border px-2.5 py-1 text-xs font-medium ${aktivCls}`
                  : "rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/50"
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LevelSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: LevelOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 w-full rounded-md border bg-card px-2 text-xs"
      >
        <option value="">— egal —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
