"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KiExtraktion } from "@/lib/ki-intake";
import {
  kiExtrahieren,
  kiJobsAnBestehendes,
  kiUnternehmenAnlegen,
} from "../actions";
import { JobKriterienEditor } from "./job-kriterien-editor";
import {
  AlertTriangle,
  Building2,
  Briefcase,
  Info,
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  Trash2,
} from "lucide-react";

type Schritt = "eingabe" | "review";

export function KiIntake({ aktiv }: { aktiv: boolean }) {
  const router = useRouter();
  const [schritt, setSchritt] = React.useState<Schritt>("eingabe");
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [extraktion, setExtraktion] = React.useState<KiExtraktion | null>(null);
  const [bestehend, setBestehend] = React.useState<{ id: string; name: string } | null>(null);
  const [antworten, setAntworten] = React.useState<Record<string, string>>({});

  const analysieren = async (runde2: boolean) => {
    setPending(true);
    const result = await kiExtrahieren(
      text,
      runde2 && extraktion
        ? {
            vorherige: extraktion,
            antworten: extraktion.rueckfragen.map((frage) => ({
              frage,
              antwort: antworten[frage] ?? "",
            })),
          }
        : undefined,
    ).catch(() => ({ ok: false as const, fehler: "Verbindung fehlgeschlagen." }));
    setPending(false);
    if (!result.ok) {
      toast.error(result.fehler);
      return;
    }
    setExtraktion(result.extraktion);
    setBestehend(result.bestehendesUnternehmen);
    setAntworten({});
    setSchritt("review");
    if (result.extraktion.rueckfragen.length > 0) {
      toast.info(
        `${result.extraktion.rueckfragen.length} Rückfrage${result.extraktion.rueckfragen.length > 1 ? "n" : ""} — bitte unten beantworten oder direkt korrigieren.`,
      );
    } else {
      toast.success("Extraktion abgeschlossen — bitte prüfen und anlegen.");
    }
  };

  const anlegen = async (anBestehendes: boolean) => {
    if (!extraktion) return;
    setPending(true);
    const result = anBestehendes && bestehend
      ? await kiJobsAnBestehendes(bestehend.id, extraktion).catch(() => ({
          ok: false as const, fehler: "Verbindung fehlgeschlagen.",
        }))
      : await kiUnternehmenAnlegen(extraktion).catch(() => ({
          ok: false as const, fehler: "Verbindung fehlgeschlagen.",
        }));
    setPending(false);
    if (!result.ok) {
      toast.error(result.fehler);
      return;
    }
    toast.success(
      anBestehendes
        ? `${result.jobsAngelegt} Job(s) an „${bestehend?.name}" angelegt.`
        : `Unternehmen angelegt${result.jobsAngelegt ? ` + ${result.jobsAngelegt} Job(s) als Entwurf` : ""}.`,
    );
    router.push(result.companyId ? `/unternehmen/${result.companyId}` : "/unternehmen");
  };

  const setU = (key: keyof KiExtraktion["unternehmen"], value: string) =>
    setExtraktion((e) =>
      e ? { ...e, unternehmen: { ...e.unternehmen, [key]: value || null } } : e,
    );

  // ── Schritt 1: Eingabe ────────────────────────────────────────────────
  if (schritt === "eingabe" || !extraktion) {
    return (
      <div className="max-w-3xl space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Alles hier einfügen — Infos über das Unternehmen UND die Stellenanzeigen, gern gemischt:\n\n„Elektro Müller GmbH aus Heilbronn, seit 1998, 25 Mitarbeiter, www.elektro-mueller.de, Ansprechpartner Jörg Müller (07131 …)\n\nWir suchen: Elektroniker für Energie- und Gebäudetechnik (m/w/d), 3.200–4.100 € je nach Erfahrung, 30 Tage Urlaub, Firmenwagen, keine Montage …“"
          }
          rows={14}
          className="bg-card font-mono text-sm"
          disabled={!aktiv}
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => analysieren(false)} disabled={pending || !aktiv || text.trim().length < 30}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {pending ? "KI analysiert…" : "Analysieren"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Nichts wird angelegt, bevor du es geprüft hast.
          </p>
        </div>
      </div>
    );
  }

  // ── Schritt 2: Review ─────────────────────────────────────────────────
  const u = extraktion.unternehmen;
  const felder: Array<[keyof typeof u, string]> = [
    ["firmenname", "Firmenname *"],
    ["ort", "Ort"],
    ["plz", "PLZ"],
    ["strasse", "Straße"],
    ["website", "Website"],
    ["kontaktName", "Ansprechpartner"],
    ["kontaktTelefon", "Telefon"],
    ["kontaktEmail", "E-Mail"],
    ["gruendungsjahr", "Gründungsjahr"],
    ["mitarbeiter", "Mitarbeiterzahl"],
    ["montage", "Montage"],
    ["urlaubstage", "Urlaubstage"],
  ];

  return (
    <div className="space-y-5">
      {/* Rückfragen */}
      {extraktion.rueckfragen.length > 0 && (
        <section className="rounded-lg border border-primary/30 bg-accent p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
            <MessageCircleQuestion className="size-4" />
            Rückfragen der KI ({extraktion.rueckfragen.length})
          </h2>
          <div className="mt-3 space-y-3">
            {extraktion.rueckfragen.map((frage) => (
              <div key={frage} className="space-y-1">
                <Label className="text-sm font-normal">{frage}</Label>
                <Input
                  value={antworten[frage] ?? ""}
                  onChange={(e) =>
                    setAntworten((a) => ({ ...a, [frage]: e.target.value }))
                  }
                  placeholder="Antwort (leer lassen = überspringen)"
                  className="bg-card"
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-card"
            onClick={() => analysieren(true)}
            disabled={pending || Object.values(antworten).every((a) => !a.trim())}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Mit Antworten verfeinern
          </Button>
        </section>
      )}

      {/* Hinweise */}
      {extraktion.hinweise.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-info" /> Annahmen der KI
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {extraktion.hinweise.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Duplikat-Warnung */}
      {bestehend && (
        <section className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-warning">
            <span className="font-semibold">„{bestehend.name}" existiert bereits.</span>{" "}
            Du kannst die extrahierten Jobs an das bestehende Unternehmen hängen
            (empfohlen) oder trotzdem ein neues anlegen.
          </p>
        </section>
      )}

      {/* Unternehmen */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-primary" /> Unternehmen
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {felder.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`u-${key}`} className="text-xs">{label}</Label>
              <Input
                id={`u-${key}`}
                value={(u[key] as string | null) ?? ""}
                onChange={(e) => setU(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          <Label htmlFor="u-beschreibung" className="text-xs">Beschreibung</Label>
          <Textarea
            id="u-beschreibung"
            value={u.beschreibung ?? ""}
            onChange={(e) => setU("beschreibung", e.target.value)}
            rows={4}
          />
        </div>
        {u.benefits.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Benefits:</span>
            {u.benefits.map((b) => (
              <Badge key={b} variant="secondary" className="font-normal">{b}</Badge>
            ))}
          </p>
        )}
      </section>

      {/* Jobs */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="size-4 text-primary" />
          Job-Inserate ({extraktion.jobs.length})
          <span className="font-normal text-muted-foreground">
            — werden als Entwurf angelegt; Kriterien danach im Stellen-Editor verfeinerbar
          </span>
        </h2>
        {extraktion.jobs.length === 0 && (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Keine Stellenanzeigen im Text erkannt.
          </p>
        )}
        {extraktion.jobs.map((job, idx) => (
          <div key={idx} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Titel</Label>
                  <Input
                    value={job.title}
                    onChange={(e) =>
                      setExtraktion((ex) => ex ? {
                        ...ex,
                        jobs: ex.jobs.map((j, i) => i === idx ? { ...j, title: e.target.value } : j),
                      } : ex)
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Stadt</Label>
                    <Input
                      value={job.city ?? ""}
                      onChange={(e) =>
                        setExtraktion((ex) => ex ? {
                          ...ex,
                          jobs: ex.jobs.map((j, i) => i === idx ? { ...j, city: e.target.value || null } : j),
                        } : ex)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gehalt min €</Label>
                    <Input
                      type="number"
                      value={job.salaryMin ?? ""}
                      onChange={(e) =>
                        setExtraktion((ex) => ex ? {
                          ...ex,
                          jobs: ex.jobs.map((j, i) => i === idx ? { ...j, salaryMin: e.target.value ? Number(e.target.value) : null } : j),
                        } : ex)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gehalt max €</Label>
                    <Input
                      type="number"
                      value={job.salaryMax ?? ""}
                      onChange={(e) =>
                        setExtraktion((ex) => ex ? {
                          ...ex,
                          jobs: ex.jobs.map((j, i) => i === idx ? { ...j, salaryMax: e.target.value ? Number(e.target.value) : null } : j),
                        } : ex)
                      }
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Job entfernen"
                onClick={() =>
                  setExtraktion((ex) => ex ? { ...ex, jobs: ex.jobs.filter((_, i) => i !== idx) } : ex)
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {/* Alle Matching-Kriterien editierbar */}
            <JobKriterienEditor
              job={job}
              onChange={(patch) =>
                setExtraktion((ex) => ex ? {
                  ...ex,
                  jobs: ex.jobs.map((j, i) => i === idx ? { ...j, ...patch } : j),
                } : ex)
              }
            />

            {job.description && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Beschreibung anzeigen
                </summary>
                <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                  {job.description}
                </p>
              </details>
            )}
          </div>
        ))}
      </section>

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button
          onClick={() => anlegen(false)}
          disabled={pending || !u.firmenname?.trim()}
          className={cn(bestehend && "order-2")}
          variant={bestehend ? "outline" : "default"}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {bestehend ? "Trotzdem neues Unternehmen anlegen" : `Unternehmen${extraktion.jobs.length ? ` + ${extraktion.jobs.length} Job(s)` : ""} anlegen`}
        </Button>
        {bestehend && extraktion.jobs.length > 0 && (
          <Button onClick={() => anlegen(true)} disabled={pending} className="order-1">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {extraktion.jobs.length} Job(s) an „{bestehend.name}" hängen
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => setSchritt("eingabe")}
          disabled={pending}
          className="order-3"
        >
          Zurück zum Text
        </Button>
      </div>
    </div>
  );
}
