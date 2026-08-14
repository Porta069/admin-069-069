"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DokumentBlatt } from "./dokument-blatt";
import type { FeldDef, FeldWerte, Position } from "@/lib/dokumente/typen";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #pw-doc-sheet, #pw-doc-sheet * { visibility: visible !important; }
  #pw-doc-sheet {
    position: absolute; left: 0; top: 0; width: 100%;
    border: none !important; box-shadow: none !important; margin: 0 !important;
  }
  @page { margin: 18mm; size: A4; }
}
`;

interface PosRow {
  bezeichnung: string;
  menge: string;
  einzelpreis: string; // Euro
}

function toCents(euro: string): number {
  return Math.round((Number(String(euro).replace(",", ".")) || 0) * 100);
}

/**
 * Editierbare PDF-Vorschau: links ein Formular aller variablen Felder (ohne KI),
 * rechts die Live-Vorschau. „Als PDF drucken" + optionale Aktionen (z. B.
 * Absenden) oben. Wiederverwendbar für jedes Dokument.
 */
export function DokumentWerkbank({
  felder,
  initialWerte,
  initialPositionen,
  mitPositionen = false,
  aktionen,
  zurueckHref,
  zurueckLabel = "Zurück",
  hinweis,
}: {
  felder: FeldDef[];
  initialWerte: FeldWerte;
  initialPositionen?: Position[];
  mitPositionen?: boolean;
  aktionen?: React.ReactNode;
  zurueckHref?: string;
  zurueckLabel?: string;
  hinweis?: string;
}) {
  const [werte, setWerte] = React.useState<FeldWerte>(initialWerte);
  const [posRows, setPosRows] = React.useState<PosRow[]>(
    (initialPositionen ?? []).map((p) => ({
      bezeichnung: p.bezeichnung,
      menge: String(p.menge),
      einzelpreis: (p.einzelpreisCents / 100).toFixed(2),
    })),
  );

  const setFeld = (key: string, v: string) =>
    setWerte((prev) => ({ ...prev, [key]: v }));

  const positionen: Position[] = posRows.map((r) => ({
    bezeichnung: r.bezeichnung,
    menge: Math.max(0, Math.round(Number(r.menge) || 0)),
    einzelpreisCents: toCents(r.einzelpreis),
  }));

  const setPos = (i: number, patch: Partial<PosRow>) =>
    setPosRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addPos = () =>
    setPosRows((prev) => [...prev, { bezeichnung: "", menge: "1", einzelpreis: "" }]);
  const removePos = (i: number) =>
    setPosRows((prev) => prev.filter((_, idx) => idx !== i));

  // Felder nach Gruppe ordnen (Reihenfolge des ersten Auftretens).
  const gruppen: string[] = [];
  for (const f of felder) if (!gruppen.includes(f.gruppe)) gruppen.push(f.gruppe);

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {zurueckHref ? (
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={zurueckHref}>
              <ArrowLeft className="size-4" />
              {zurueckLabel}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Als PDF drucken
          </Button>
          {aktionen}
        </div>
      </div>

      {hinweis && (
        <div className="mb-4 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info print:hidden">
          {hinweis}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="space-y-5 print:hidden">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Felder bearbeiten</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Änderungen erscheinen sofort in der Vorschau.
            </p>
            <div className="mt-4 space-y-5">
              {gruppen.map((g) => (
                <div key={g} className="space-y-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {g}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {felder
                      .filter((f) => f.gruppe === g)
                      .map((f) => (
                        <div
                          key={f.key}
                          className={f.breit || f.typ === "textarea" ? "col-span-2 space-y-1.5" : "space-y-1.5"}
                        >
                          <Label htmlFor={`f-${f.key}`} className="text-xs">
                            {f.label}
                          </Label>
                          {f.typ === "textarea" ? (
                            <Textarea
                              id={`f-${f.key}`}
                              value={werte[f.key] ?? ""}
                              onChange={(e) => setFeld(f.key, e.target.value)}
                              rows={4}
                            />
                          ) : (
                            <Input
                              id={`f-${f.key}`}
                              value={werte[f.key] ?? ""}
                              onChange={(e) => setFeld(f.key, e.target.value)}
                              inputMode={f.typ === "number" ? "numeric" : undefined}
                            />
                          )}
                          {f.hint && (
                            <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {mitPositionen && (
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Positionen
                  </p>
                  {posRows.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Input
                        value={r.bezeichnung}
                        onChange={(e) => setPos(i, { bezeichnung: e.target.value })}
                        placeholder="Bezeichnung"
                        className="flex-1"
                      />
                      <Input
                        value={r.menge}
                        onChange={(e) => setPos(i, { menge: e.target.value })}
                        inputMode="numeric"
                        className="w-12"
                        aria-label="Menge"
                      />
                      <Input
                        value={r.einzelpreis}
                        onChange={(e) => setPos(i, { einzelpreis: e.target.value })}
                        inputMode="decimal"
                        placeholder="€"
                        className="w-20"
                        aria-label="Einzelpreis in Euro"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePos(i)}
                        className="shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addPos}>
                    <Plus className="size-4" />
                    Position hinzufügen
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vorschau */}
        <div>
          <DokumentBlatt werte={werte} positionen={mitPositionen ? positionen : undefined} />
        </div>
      </div>
    </>
  );
}
