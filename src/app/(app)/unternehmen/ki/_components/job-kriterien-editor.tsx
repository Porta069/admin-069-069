"use client";

import * as React from "react";
import type { KiJob } from "@/lib/ki-intake";
import {
  GEWERK_OPTIONS,
  ABSCHLUSS_OPTIONS,
  DEUTSCH_OPTIONS,
  ERFAHRUNG_OPTIONS,
  FUEHRERSCHEIN_OPTIONS,
  MONTAGE_MIN_OPTIONS,
  START_OPTIONS,
  WUENSCHE_OPTIONS,
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
  const berufeAuswahl = berufeOptionsFuer(job.gewerke);
  const aufgabenAuswahl = aufgabenOptionsFuer(job.gewerke);

  const toggle = (key: "berufe" | "aufgaben" | "gebotenes", value: string) => {
    const list = job[key];
    onChange({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    } as Partial<KiJob>);
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed bg-accent/20 p-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Optimale Kandidaten-Kriterien · alle Registrierungsfelder
      </p>

      {/* Ausschluss: Gewerk(e) der Stelle (erstes = Pflicht-Gewerk) */}
      <ChipGroup
        label="Gewerk(e) der Stelle"
        options={GEWERK_OPTIONS}
        selected={job.gewerke}
        hint="erstes = Gewerk der Stelle; alle = akzeptiert"
        onToggle={(v) => {
          const next = job.gewerke.includes(v)
            ? job.gewerke.filter((x) => x !== v)
            : [...job.gewerke, v];
          const erlaubtBerufe = new Set(berufeOptionsFuer(next).map((o) => o.value));
          const erlaubtAufgaben = new Set(aufgabenOptionsFuer(next).map((o) => o.value));
          onChange({
            gewerke: next,
            gewerk: next[0] ?? "",
            berufe: job.berufe.filter((b) => erlaubtBerufe.has(b)),
            aufgaben: job.aufgaben.filter((a) => erlaubtAufgaben.has(a)),
          });
        }}
      />

      {job.gewerke.length > 0 && (
        <ChipGroup
          label="Bevorzugte Ausbildungsberufe"
          options={berufeAuswahl}
          selected={job.berufe}
          onToggle={(v) => toggle("berufe", v)}
          hint="fließt gewichtet ein"
        />
      )}

      <TagFreetext
        label="Stichworte zur Berufsbezeichnung"
        hint="Freitext, fließt gewichtet ein (max 10)"
        value={job.bezeichnungTags}
        onChange={(v) => onChange({ bezeichnungTags: v })}
      />

      {job.gewerke.length > 0 && (
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

      {/* Bool-Anforderungen */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={job.meisterErwuenscht}
            onChange={(e) => onChange({ meisterErwuenscht: e.target.checked })}
            className="size-3.5 accent-primary"
          />
          Meister / Techniker gewünscht{" "}
          <span className="text-muted-foreground">(Punkte, kein Ausschluss)</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={job.fuehrungGefordert}
            onChange={(e) => onChange({ fuehrungGefordert: e.target.checked })}
            className="size-3.5 accent-primary"
          />
          Führungsverantwortung verlangt{" "}
          <span className="text-muted-foreground">(⚠ Ausschluss)</span>
        </label>
      </div>

      {/* Skalen als Selects */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <LevelSelect label="Erfahrung ab" options={ERFAHRUNG_OPTIONS} value={job.erfahrungMin} onChange={(v) => onChange({ erfahrungMin: v })} />
        <LevelSelect label="Erfahrung bis" options={ERFAHRUNG_OPTIONS} value={job.erfahrungMax} onChange={(v) => onChange({ erfahrungMax: v })} />
        <LevelSelect label="Abschluss mind." options={ABSCHLUSS_OPTIONS} value={job.abschlussMin} onChange={(v) => onChange({ abschlussMin: v })} />
        <LevelSelect label="Deutsch mind." options={DEUTSCH_OPTIONS} value={job.deutschMin} onChange={(v) => onChange({ deutschMin: v })} />
        <LevelSelect label="Führerschein mind." options={FUEHRERSCHEIN_OPTIONS} value={job.fuehrerscheinMin} onChange={(v) => onChange({ fuehrerscheinMin: v })} />
        <LevelSelect label="Montage mind." options={MONTAGE_MIN_OPTIONS} value={job.montageMin} onChange={(v) => onChange({ montageMin: v })} />
        <LevelSelect label="Besetzen bis" options={START_OPTIONS} value={job.startBis} onChange={(v) => onChange({ startBis: v })} />
      </div>

      {/* Gebotenes */}
      <ChipGroup
        label="Was der Betrieb bietet"
        options={WUENSCHE_OPTIONS}
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

/** Freitext-Stichworte (Chips) — Enter/Komma fügt hinzu, × entfernt. */
function TagFreetext({
  label,
  hint,
  value,
  onChange,
  max = 10,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [text, setText] = React.useState("");
  const add = () => {
    const t = text.trim().toLowerCase();
    setText("");
    if (t.length < 2 || t.length > 60) return;
    if (!value.includes(t) && value.length < max) onChange([...value, t]);
  };
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">— {hint}</span>}
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`${t} entfernen`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        disabled={value.length >= max}
        placeholder={value.length >= max ? "max. 10 erreicht" : "Stichwort + Enter…"}
        className="h-8 w-full rounded-md border bg-card px-2 text-xs disabled:opacity-60"
      />
    </div>
  );
}
