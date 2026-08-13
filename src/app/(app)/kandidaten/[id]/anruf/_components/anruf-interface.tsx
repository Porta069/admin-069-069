"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Minus,
  PhoneCall,
  Sparkles,
  Trophy,
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
import { anrufSpeichern } from "../actions";

interface Frage {
  key: string;
  label: string;
  frage: string;
  optionen: { value: string; label: string }[];
}
interface Job {
  jobId: string;
  title: string;
  companyName: string | null;
  score: number;
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

export function AnrufInterface({
  applicationId,
  candidateName,
  email,
  phone,
  taskId,
  topJobs,
  fragen,
}: {
  applicationId: string;
  candidateName: string;
  email: string;
  phone: string | null;
  taskId: string | null;
  topJobs: Job[];
  fragen: Frage[];
}) {
  const router = useRouter();
  const [antworten, setAntworten] = React.useState<Record<string, string>>({});
  // Live-Ranking: startet mit dem Ausgangs-Ranking, wird durch Antworten ersetzt.
  const [jobs, setJobs] = React.useState<Job[]>(topJobs);
  // Ausgangswerte, um die Verschiebung (▲/▼) zu zeigen.
  const ausgang = React.useRef<Record<string, number>>(
    Object.fromEntries(topJobs.map((j) => [j.jobId, j.score])),
  );
  const [rechnet, setRechnet] = React.useState(false);
  const [speichert, setSpeichert] = React.useState(false);
  const [notiz, setNotiz] = React.useState("");
  const [abgeschlossen, setAbgeschlossen] = React.useState(false);

  const beantwortet = Object.values(antworten).filter(Boolean).length;

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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Linke Spalte: Fragen */}
      <div className="space-y-6">
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
  );
}
