"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DokumentBlatt } from "@/components/dokumente/dokument-blatt";
import { SENDER_DEFAULT } from "@/lib/dokumente/felder";
import type { FeldWerte } from "@/lib/dokumente/typen";
import { saveVorlage } from "../actions";

interface Variable {
  key: string;
  label: string;
  beispiel: string;
}
type TextFeld = "titel" | "betreff" | "einleitung" | "schluss";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #pw-doc-sheet, #pw-doc-sheet * { visibility: visible !important; }
  #pw-doc-sheet { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; margin: 0 !important; }
  @page { margin: 18mm; size: A4; }
}`;

function heute(): string {
  try {
    return new Intl.DateTimeFormat("de-DE").format(new Date());
  } catch {
    return "";
  }
}

export function VorlagenEditor({
  event,
  name,
  variablen,
  initial,
}: {
  event: string;
  name: string;
  variablen: Variable[];
  initial: {
    titel: string;
    betreff: string;
    einleitung: string;
    schluss: string;
    enabled: boolean;
  };
}) {
  const [text, setText] = React.useState({
    titel: initial.titel,
    betreff: initial.betreff,
    einleitung: initial.einleitung,
    schluss: initial.schluss,
  });
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [beispiele, setBeispiele] = React.useState<Record<string, string>>(
    () => Object.fromEntries(variablen.map((v) => [v.key, v.beispiel])),
  );
  const [aktivesFeld, setAktivesFeld] = React.useState<TextFeld>("einleitung");
  const [speichert, setSpeichert] = React.useState(false);

  const refs: Record<TextFeld, React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>> = {
    titel: React.useRef<HTMLInputElement>(null),
    betreff: React.useRef<HTMLInputElement>(null),
    einleitung: React.useRef<HTMLTextAreaElement>(null),
    schluss: React.useRef<HTMLTextAreaElement>(null),
  };

  const setFeld = (f: TextFeld, v: string) =>
    setText((prev) => ({ ...prev, [f]: v }));

  function insertVar(key: string) {
    const el = refs[aktivesFeld].current;
    const marker = `{{${key}}}`;
    const cur = text[aktivesFeld];
    const pos = el && el.selectionStart != null ? el.selectionStart : cur.length;
    const next = cur.slice(0, pos) + marker + cur.slice(pos);
    setFeld(aktivesFeld, next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const p = pos + marker.length;
        el.setSelectionRange?.(p, p);
      }
    });
  }

  const subst = (s: string) =>
    (s ?? "").replace(/\{\{(\w+)\}\}/g, (_m, k) =>
      beispiele[k] != null && beispiele[k] !== "" ? beispiele[k] : `{{${k}}}`,
    );

  const werte: FeldWerte = {
    ...SENDER_DEFAULT,
    empfaengerName: beispiele.name ?? "",
    empfaengerAdresse: [beispiele.email, beispiele.telefon || beispiele.neue_nummer]
      .filter(Boolean)
      .join("\n"),
    titel: subst(text.titel),
    datum: heute(),
    betreff: subst(text.betreff),
    einleitung: subst(text.einleitung),
    schluss: subst(text.schluss),
  };

  const speichern = () => {
    setSpeichert(true);
    saveVorlage(event, { ...text, enabled })
      .then((res) => {
        if (res.ok) toast.success(res.message ?? "Gespeichert.");
        else toast.error(res.message);
      })
      .catch(() => toast.error("Verbindung fehlgeschlagen."))
      .finally(() => setSpeichert(false));
  };

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/belege">
            <ArrowLeft className="size-4" />
            Zurück zu Vorlagen
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            {enabled ? "Aktiv" : "Inaktiv"}
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Als PDF drucken
          </Button>
          <Button size="sm" onClick={speichern} disabled={speichert}>
            {speichert ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Speichern
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-info/30 bg-info-soft px-4 py-3 text-sm text-info print:hidden">
        Vorlage für „{name}". Platzhalter wie <code>{"{{name}}"}</code> werden beim
        autonomen Versand automatisch mit den echten Daten des Empfängers ersetzt.
        Rechts siehst du die Vorschau mit Beispielwerten.
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="space-y-4 print:hidden">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Vorlage bearbeiten</h2>

            {/* Variablen zum Einfügen */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                Feld ins aktive Textfeld einfügen:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {variablen.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title={`{{${v.key}}} — ${v.label}`}
                  >
                    {"{{"}
                    {v.key}
                    {"}}"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-titel" className="text-xs">Titel</Label>
                <Input
                  id="v-titel"
                  ref={refs.titel as React.RefObject<HTMLInputElement>}
                  value={text.titel}
                  onFocus={() => setAktivesFeld("titel")}
                  onChange={(e) => setFeld("titel", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-betreff" className="text-xs">Betreff</Label>
                <Input
                  id="v-betreff"
                  ref={refs.betreff as React.RefObject<HTMLInputElement>}
                  value={text.betreff}
                  onFocus={() => setAktivesFeld("betreff")}
                  onChange={(e) => setFeld("betreff", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-einleitung" className="text-xs">Haupttext</Label>
                <Textarea
                  id="v-einleitung"
                  ref={refs.einleitung as React.RefObject<HTMLTextAreaElement>}
                  value={text.einleitung}
                  onFocus={() => setAktivesFeld("einleitung")}
                  onChange={(e) => setFeld("einleitung", e.target.value)}
                  rows={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-schluss" className="text-xs">Schluss</Label>
                <Textarea
                  id="v-schluss"
                  ref={refs.schluss as React.RefObject<HTMLTextAreaElement>}
                  value={text.schluss}
                  onFocus={() => setAktivesFeld("schluss")}
                  onChange={(e) => setFeld("schluss", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Beispielwerte für die Vorschau */}
          {variablen.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold">Beispielwerte</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Nur für die Vorschau — beim Versand kommen die echten Empfängerdaten.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {variablen.map((v) => (
                  <div key={v.key} className="space-y-1.5">
                    <Label htmlFor={`b-${v.key}`} className="text-xs">
                      {v.label}
                    </Label>
                    <Input
                      id={`b-${v.key}`}
                      value={beispiele[v.key] ?? ""}
                      onChange={(e) =>
                        setBeispiele((prev) => ({ ...prev, [v.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Vorschau */}
        <div>
          <DokumentBlatt werte={werte} />
        </div>
      </div>
    </>
  );
}
