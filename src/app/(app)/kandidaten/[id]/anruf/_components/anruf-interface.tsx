"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Crown,
  Loader2,
  MessageSquareQuote,
  Minus,
  PhoneCall,
  Sparkles,
  Trophy,
  UserCheck,
  UserRound,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { kostenLabelFuer } from "@/lib/ki/kosten";
import {
  anrufSpeichern,
  bearbeiterZuweisen,
  generiereZusatzfragen,
  kiErgebnisFuer,
  kiPitchFuer,
  kiZusammenfassungFuer,
} from "../actions";
import type {
  KiGespraechsergebnis,
  KiPitch,
  KiZusammenfassung,
  KiZusatzErgebnis,
} from "@/lib/matching/anruf";

interface Frage {
  key: string;
  label: string;
  frage: string;
  optionen: { value: string; label: string }[];
}
interface Kriterium {
  key: string;
  label: string;
  required: string;
  answer: string;
  fulfilment: number;
}
interface Job {
  jobId: string;
  title: string;
  companyName: string | null;
  score: number;
  kriterien: Kriterium[];
}
interface Bearbeiter {
  id: string;
  name: string;
  avatarColor: string | null;
}

/** Farbton je Score-Bereich — konsistent mit dem Matching-Score-Design. */
function scoreTon(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-info";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}
function scoreBalken(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-info";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
}

/** Sehr kleine, unaufdringliche Kostenschätzung neben einem KI-Button. */
function KostenHinweis({ funktion }: { funktion: string }) {
  const label = kostenLabelFuer(funktion);
  if (!label) return null;
  return (
    <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
  );
}

export function AnrufInterface({
  applicationId,
  candidateName,
  email,
  phone,
  taskId,
  topJobs,
  fragen,
  gleichstand,
  bearbeiter,
  aktuellerBearbeiterId,
}: {
  applicationId: string;
  candidateName: string;
  email: string;
  phone: string | null;
  taskId: string | null;
  topJobs: Job[];
  fragen: Frage[];
  gleichstand: boolean;
  bearbeiter?: Bearbeiter[];
  aktuellerBearbeiterId?: string | null;
}) {
  const router = useRouter();
  const [antworten, setAntworten] = React.useState<Record<string, string>>({});
  // Live-Ranking: startet mit dem Ausgangs-Ranking, wird durch Antworten ersetzt.
  const [jobs, setJobs] = React.useState<Job[]>(topJobs);
  // Vergleich: welche Betriebe sind ausgewählt (Default: alle).
  const [ausgewaehlt, setAusgewaehlt] = React.useState<Set<string>>(
    () => new Set(topJobs.map((j) => j.jobId)),
  );
  const [kiRechnet, setKiRechnet] = React.useState(false);
  const [kiErgebnis, setKiErgebnis] = React.useState<KiZusatzErgebnis | null>(null);
  // Ausgangswerte, um die Verschiebung (▲/▼) zu zeigen.
  const ausgang = React.useRef<Record<string, number>>(
    Object.fromEntries(topJobs.map((j) => [j.jobId, j.score])),
  );
  const [rechnet, setRechnet] = React.useState(false);
  const [speichert, setSpeichert] = React.useState(false);
  const [notiz, setNotiz] = React.useState("");
  const [abgeschlossen, setAbgeschlossen] = React.useState(false);

  // ── Bearbeiter (wer den Anruf übernimmt) ───────────────────────────────
  const [bearbeiterId, setBearbeiterId] = React.useState(
    aktuellerBearbeiterId ?? "",
  );
  const [bearbeiterSpeichert, setBearbeiterSpeichert] = React.useState(false);
  const aktuellerBearbeiter = bearbeiter?.find((b) => b.id === bearbeiterId);

  // ── KI-Assistenz-Zustände ──────────────────────────────────────────────
  const [zusammenfassung, setZusammenfassung] =
    React.useState<KiZusammenfassung | null>(null);
  const [zusammenfassungLaedt, setZusammenfassungLaedt] = React.useState(false);
  const [pitch, setPitch] = React.useState<KiPitch | null>(null);
  const [pitchLaedt, setPitchLaedt] = React.useState(false);
  const [ergebnis, setErgebnis] = React.useState<KiGespraechsergebnis | null>(null);
  const [ergebnisLaedt, setErgebnisLaedt] = React.useState(false);
  const [kopiert, setKopiert] = React.useState(false);

  const beantwortet = Object.values(antworten).filter(Boolean).length;
  const topMatch = jobs[0] ?? null;

  async function waehleBearbeiter(id: string) {
    const vorher = bearbeiterId;
    setBearbeiterId(id);
    setBearbeiterSpeichert(true);
    const res = await bearbeiterZuweisen(taskId, applicationId, id);
    setBearbeiterSpeichert(false);
    if (!res.ok) {
      setBearbeiterId(vorher);
      toast.error(res.fehler);
      return;
    }
    toast.success(`${res.employeeName} übernimmt diesen Anruf.`);
  }

  async function neuBewerten() {
    setRechnet(true);
    const res = await anrufSpeichern(
      applicationId,
      candidateName,
      email,
      fragen,
      antworten,
      topJobs.map((j) => ({
        jobId: j.jobId,
        title: j.title,
        companyName: j.companyName,
      })),
      taskId,
      notiz,
      false,
    );
    setRechnet(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setJobs(res.scores);
    toast.success("Ranking anhand der Antworten aktualisiert.");
  }

  async function abschliessen() {
    setSpeichert(true);
    const res = await anrufSpeichern(
      applicationId,
      candidateName,
      email,
      fragen,
      antworten,
      topJobs.map((j) => ({
        jobId: j.jobId,
        title: j.title,
        companyName: j.companyName,
      })),
      taskId,
      notiz,
      true,
    );
    setSpeichert(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setJobs(res.scores);
    setAbgeschlossen(true);
    toast.success("Anruf gespeichert. Aufgabe als erledigt markiert.");
    router.refresh();
  }

  // ── KI-Assistenz: Handler ──────────────────────────────────────────────
  async function ladeZusammenfassung() {
    setZusammenfassungLaedt(true);
    const res = await kiZusammenfassungFuer(
      email,
      topJobs.map((j) => j.title),
    );
    setZusammenfassungLaedt(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setZusammenfassung(res.ergebnis);
  }

  async function ladePitch() {
    if (!topMatch) {
      toast.error("Aktuell kein Top-Match zum Pitchen vorhanden.");
      return;
    }
    setPitchLaedt(true);
    const res = await kiPitchFuer({
      email,
      jobTitle: topMatch.title,
      companyName: topMatch.companyName,
      kriterien: topMatch.kriterien,
    });
    setPitchLaedt(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setPitch(res.ergebnis);
  }

  async function ladeErgebnis() {
    const beantworteteFragen = fragen
      .filter((f) => antworten[f.key])
      .map((f) => ({
        label: f.label,
        wert:
          f.optionen.find((o) => o.value === antworten[f.key])?.label ??
          antworten[f.key],
      }));
    setErgebnisLaedt(true);
    const res = await kiErgebnisFuer({
      notiz,
      antworten: beantworteteFragen,
      topMatch: topMatch
        ? {
            title: topMatch.title,
            companyName: topMatch.companyName,
            score: topMatch.score,
          }
        : null,
    });
    setErgebnisLaedt(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setErgebnis(res.ergebnis);
  }

  function dokuUebernehmen(text: string) {
    setNotiz((n) => (n.trim() ? `${n.trim()}\n${text}` : text));
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 1500);
    toast.success("Dokumentationstext in die Notiz übernommen.");
  }

  // ── Vergleich „Was passt (nicht)?" ─────────────────────────────────────
  const gewaehlteJobs = jobs.filter((j) => ausgewaehlt.has(j.jobId));
  const kriterienKeys: string[] = [];
  for (const j of gewaehlteJobs) {
    for (const c of j.kriterien) {
      if (!kriterienKeys.includes(c.key)) kriterienKeys.push(c.key);
    }
  }
  const tabelle = kriterienKeys.map((key) => {
    const beispiel = gewaehlteJobs
      .flatMap((j) => j.kriterien)
      .find((c) => c.key === key)!;
    const zellen = gewaehlteJobs.map((j) => {
      const c = j.kriterien.find((x) => x.key === key);
      return {
        jobId: j.jobId,
        required: c?.required ?? "—",
        fulfilment: c?.fulfilment ?? 1,
      };
    });
    return { key, label: beispiel.label, kandidat: beispiel.answer, zellen };
  });

  function toggleJob(jobId: string) {
    setAusgewaehlt((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  // Diffs für die KI: nur Kriterien, in denen sich die gewählten Betriebe
  // im Soll unterscheiden (minimaler Input → Token-sparsam).
  function baueDiffs() {
    const diffs = [];
    for (const row of tabelle) {
      const sollWerte = new Set(row.zellen.map((z) => z.required));
      if (sollWerte.size <= 1) continue;
      diffs.push({
        kriterium: row.label,
        betriebe: row.zellen.map((z) => {
          const j = gewaehlteJobs.find((g) => g.jobId === z.jobId)!;
          return { name: j.companyName ?? j.title, soll: z.required };
        }),
        kandidatAntwort: row.kandidat,
      });
    }
    return diffs;
  }

  async function zusatzfragenGenerieren() {
    setKiRechnet(true);
    const res = await generiereZusatzfragen(baueDiffs());
    setKiRechnet(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setKiErgebnis(res.ergebnis);
  }

  const kannKi = gleichstand && gewaehlteJobs.length >= 2 && baueDiffs().length > 0;

  return (
    <div className="space-y-4">
      {/* Bearbeiterzuordnung: wer diesen Anruf übernimmt */}
      {bearbeiter && bearbeiter.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCheck className="size-4 text-primary" /> Bearbeiter
            </div>
            <div className="flex items-center gap-2">
              <EmployeeAvatar
                name={aktuellerBearbeiter?.name ?? null}
                color={aktuellerBearbeiter?.avatarColor}
                size="sm"
              />
              <Select value={bearbeiterId} onValueChange={waehleBearbeiter}>
                <SelectTrigger className="h-8 w-56">
                  <SelectValue placeholder="Bearbeiter wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {bearbeiter.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bearbeiterSpeichert && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Übernimmt und verantwortet dieses Telefonat — wird protokolliert.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Linke Spalte: Fragen */}
        <div className="space-y-6">
          {/* KI-Assistenz während des Telefonats */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> KI-Assistenz
              </CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Wand2 className="size-3" /> On-demand
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* (a) Bewerber-Zusammenfassung */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Bewerber-Zusammenfassung</p>
                      <p className="text-xs text-muted-foreground">
                        Kurzprofil &amp; Kernstärken für den Gesprächseinstieg.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={ladeZusammenfassung}
                      disabled={zusammenfassungLaedt}
                    >
                      {zusammenfassungLaedt ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wand2 className="size-4" />
                      )}
                      Erstellen
                    </Button>
                    <KostenHinweis funktion="zusammenfassung" />
                  </div>
                </div>
                {zusammenfassung && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="whitespace-pre-line text-sm">
                      {zusammenfassung.zusammenfassung}
                    </p>
                    {zusammenfassung.staerken.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {zusammenfassung.staerken.map((s, i) => (
                          <Badge key={i} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* (b) Job-Argumente / Pitch für den Top-Match */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Pitch für den Top-Match</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {topMatch
                          ? `Argumente für „${topMatch.companyName ?? topMatch.title}"`
                          : "Sobald ein Top-Match feststeht."}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={ladePitch}
                      disabled={pitchLaedt || !topMatch}
                    >
                      {pitchLaedt ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MessageSquareQuote className="size-4" />
                      )}
                      Argumente
                    </Button>
                    <KostenHinweis funktion="pitch" />
                  </div>
                </div>
                {pitch && pitch.argumente.length > 0 && (
                  <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                    {pitch.argumente.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* (c) Gesprächsergebnis & nächste Schritte */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Gesprächsergebnis</p>
                      <p className="text-xs text-muted-foreground">
                        Fasst Notiz &amp; Antworten zusammen und schlägt Schritte vor.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={ladeErgebnis}
                      disabled={ergebnisLaedt}
                    >
                      {ergebnisLaedt ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ClipboardList className="size-4" />
                      )}
                      Auswerten
                    </Button>
                    <KostenHinweis funktion="ergebnis" />
                  </div>
                </div>
                {ergebnis && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm">{ergebnis.zusammenfassung}</p>
                    {ergebnis.naechsteSchritte.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Nächste Schritte
                        </p>
                        <ul className="space-y-1">
                          {ergebnis.naechsteSchritte.map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                              <span className="text-primary">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ergebnis.dokumentation && (
                      <div className="rounded-md border bg-background p-2.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Dokumentationsvorschlag
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-xs"
                            onClick={() => dokuUebernehmen(ergebnis.dokumentation)}
                          >
                            {kopiert ? (
                              <Check className="size-3.5 text-success" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            In Notiz übernehmen
                          </Button>
                        </div>
                        <p className="whitespace-pre-line text-sm text-muted-foreground">
                          {ergebnis.dokumentation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="size-4 text-primary" /> Gesprächsleitfaden
              </CardTitle>
              <div className="flex items-center gap-2">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <PhoneCall className="size-3.5" /> {phone}
                  </a>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" /> {fragen.length} Fragen
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {fragen.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Für diesen Kandidaten trennen keine offenen Kriterien die Top-Stellen
                  weiter — das Profil ist bereits eindeutig. Frag dich am Telefon durch
                  die üblichen Punkte und halte Besonderheiten unten in der Notiz fest.
                </p>
              )}
              {fragen.map((f, i) => (
                <div key={f.key} className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{f.frage}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.label}</p>
                    </div>
                  </div>
                  <div className="pl-7.5">
                    <Select
                      value={antworten[f.key] ?? ""}
                      onValueChange={(v) =>
                        setAntworten((a) => ({ ...a, [f.key]: v }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Antwort auswählen …" />
                      </SelectTrigger>
                      <SelectContent>
                        {f.optionen.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              {fragen.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">
                    {beantwortet} von {fragen.length} beantwortet
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={neuBewerten}
                    disabled={rechnet || beantwortet === 0}
                  >
                    {rechnet ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Ranking aktualisieren
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notiz zum Gespräch</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Eindruck, Verfügbarkeit, Besonderheiten …"
                rows={4}
              />
            </CardContent>
          </Card>

          {gewaehlteJobs.length > 0 && tabelle.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">
                  Vergleich: Was passt (nicht)?
                </CardTitle>
                {gleichstand && (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={zusatzfragenGenerieren}
                      disabled={!kannKi || kiRechnet}
                      title={
                        kannKi
                          ? "KI prüft die Unterschiede der gleichauf liegenden Betriebe"
                          : "Erst bei ausgewählten Betrieben mit unterschiedlichen Anforderungen"
                      }
                    >
                      {kiRechnet ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      KI-Fragen generieren
                    </Button>
                    <KostenHinweis funktion="fragen" />
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {gleichstand && (
                  <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                    Mehrere Betriebe liegen gleichauf — die KI prüft anhand der
                    Unterschiede (und nur dieser), ob weitere Fragen den besten
                    Match schärfen.
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {jobs.map((j) => {
                    const on = ausgewaehlt.has(j.jobId);
                    return (
                      <button
                        key={j.jobId}
                        type="button"
                        onClick={() => toggleJob(j.jobId)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {j.companyName ?? j.title} · {Math.round(j.score)}%
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[440px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Kriterium</th>
                        <th className="py-2 pr-3 font-medium">Antwort Kandidat</th>
                        {gewaehlteJobs.map((j) => (
                          <th key={j.jobId} className="py-2 pr-3 font-medium">
                            {j.companyName ?? j.title}
                            <span className="block font-normal text-muted-foreground/70">
                              optimal
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabelle.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b align-top last:border-0"
                        >
                          <td className="py-2 pr-3 font-medium">{row.label}</td>
                          <td className="py-2 pr-3">{row.kandidat}</td>
                          {row.zellen.map((z) => (
                            <td key={z.jobId} className="py-2 pr-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  z.fulfilment >= 1
                                    ? "text-success"
                                    : z.fulfilment > 0
                                      ? "text-warning"
                                      : "text-destructive",
                                )}
                              >
                                {z.fulfilment >= 1 ? (
                                  <CheckCircle2 className="size-3.5 shrink-0" />
                                ) : (
                                  <Minus className="size-3.5 shrink-0" />
                                )}
                                {z.required}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Grün = passt vollständig, gelb/rot = weicht ab. „optimal" ist die
                  vom Betrieb geforderte Antwort.
                </p>

                {kiErgebnis && (
                  <div className="rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className="size-4 text-primary" />
                      {kiErgebnis.weitereNoetig
                        ? "Weitere Fragen empfohlen"
                        : "Keine weiteren Fragen nötig"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {kiErgebnis.begruendung}
                    </p>
                    {kiErgebnis.fragen.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {kiErgebnis.fragen.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <span className="text-primary">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rechte Spalte: Live-Ranking + Abschluss */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-primary" /> Beste Job-Matches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aktuell keine passenden aktiven Stellen.
                </p>
              )}
              {jobs.map((j, i) => {
                const start = ausgang.current[j.jobId];
                const delta =
                  start != null ? Math.round(j.score - start) : 0;
                return (
                  <div
                    key={j.jobId}
                    className={cn(
                      "rounded-lg border p-3",
                      i === 0 && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {i === 0 && (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                            <Crown className="size-3" /> Top-Match
                          </span>
                        )}
                        <p className="truncate text-sm font-medium">{j.title}</p>
                        {j.companyName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {j.companyName}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            scoreTon(j.score),
                          )}
                        >
                          {Math.round(j.score)}%
                        </span>
                        {delta !== 0 && (
                          <span
                            className={cn(
                              "flex items-center text-[11px] font-medium tabular-nums",
                              delta > 0 ? "text-success" : "text-destructive",
                            )}
                          >
                            {delta > 0 ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )}
                            {Math.abs(delta)}
                          </span>
                        )}
                        {delta === 0 && start != null && (
                          <Minus className="size-3 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          scoreBalken(j.score),
                        )}
                        style={{ width: `${Math.max(3, Math.round(j.score))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={abschliessen}
            disabled={speichert || abgeschlossen}
          >
            {speichert ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {abgeschlossen ? "Anruf abgeschlossen" : "Anruf abschließen"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Speichert Antworten, Ranking &amp; Notiz und markiert die Aufgabe als
            erledigt.
          </p>
        </div>
      </div>
    </div>
  );
}
