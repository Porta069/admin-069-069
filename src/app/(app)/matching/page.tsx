import { Suspense } from "react";
import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Ban,
  Building2,
  ChevronDown,
  CloudOff,
  EyeOff,
  Sparkles,
  UserSquare2,
} from "lucide-react";
import { ParamCombobox } from "@/components/common/param-combobox";
// Wiederverwendung aus dem Stellen-Modul — ausdrücklich erlaubt.
import { IdealProfile } from "../stellen/_components/ideal-profile";
import { weightLabel, type JobCriteriaFields } from "../stellen/_lib/job-criteria";
import {
  rankCandidatesForJob,
  rankJobsForProfile,
} from "@/lib/matching/rank";
import { ladeWorkerProfile } from "@/lib/matching/profile";
import { getKatalog } from "@/lib/matching/catalog-live";
import { STANDARD_GEWICHTE } from "@/lib/matching/scoring";
import type { MatchBreakdown } from "@/lib/matching/scoring";

export const metadata = { title: "Matching-Center" };

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("matching");
  const params = await searchParams;
  const jobId = firstParam(params.job);
  const kandidatId = firstParam(params.kandidat);
  const richtung =
    firstParam(params.richtung) === "kandidat" || (kandidatId && !jobId)
      ? "kandidat"
      : "job";

  const [{ quelle }, jobs, kandidaten] = await Promise.all([
    getKatalog(),
    sql`
      select j.id, j.title, c.name as company
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.status = 'ACTIVE'
      order by j."createdAt" desc limit 200`,
    sql`
      select a.id, a."firstName", a."lastName", a.profession, a.phone
      from admin.candidate a
      join admin.candidate_meta cm
        on cm.application_id = a.id and cm.aktiviert_at is not null
      where a.status <> 'ERASED'
      order by a."createdAt" desc limit 200`,
  ]);

  return (
    <>
      <PageHeader
        title="Matching-Center"
        description="Die echte Engine-Bewertung: erst harte Ausschlüsse, dann die gewichtete Punktwertung — vollständig offengelegt."
      />

      {quelle === "fallback" && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning">
          <CloudOff className="size-4 shrink-0" />
          Fachkatalog gerade nicht erreichbar — lokale Kopie aktiv. Labels
          könnten veraltet sein.
        </div>
      )}

      <SoFunktioniertsKarte />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-card p-0.5">
          <Link
            href="/matching"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              richtung === "job"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Kandidaten für Job
          </Link>
          <Link
            href="/matching?richtung=kandidat"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              richtung === "kandidat"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Jobs für Kandidat
          </Link>
        </div>
        {richtung === "job" ? (
          <ParamCombobox
            param="job"
            placeholder="Aktive Stelle wählen…"
            options={jobs.map((j) => ({
              value: j.id as string,
              label: j.title as string,
              hint: (j.company as string | null) ?? undefined,
            }))}
            className="w-96 max-w-full"
          />
        ) : (
          <ParamCombobox
            param="kandidat"
            placeholder="Kandidat wählen…"
            options={kandidaten.map((k) => ({
              value: k.id as string,
              label: `${k.firstName} ${k.lastName}`,
              hint: [k.profession, k.phone].filter(Boolean).join(" · ") || undefined,
            }))}
            className="w-96 max-w-full"
          />
        )}
      </div>

      <div className="mt-5 space-y-5">
        {richtung === "job" &&
          (jobId ? (
            <Suspense key={jobId} fallback={<RankingSkeleton />}>
              <JobDirection jobId={jobId} />
            </Suspense>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Keine Stelle ausgewählt"
              description="Wähle oben eine aktive Stellenanzeige — alle Kandidaten werden mit der echten Engine-Formel gegen sie bewertet."
            />
          ))}
        {richtung === "kandidat" &&
          (kandidatId ? (
            <Suspense key={kandidatId} fallback={<RankingSkeleton />}>
              <KandidatDirection kandidatId={kandidatId} />
            </Suspense>
          ) : (
            <EmptyState
              icon={UserSquare2}
              title="Kein Kandidat ausgewählt"
              description="Wähle oben einen Kandidaten — alle aktiven Stellen werden für ihn bewertet, inklusive der ausgeblendeten."
            />
          ))}
      </div>
    </>
  );
}

/* ── Erklärung: die zwei Stufen der Engine ─────────────────────────────── */

function SoFunktioniertsKarte() {
  const gewichte = Object.entries(STANDARD_GEWICHTE);
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5 lg:grid-cols-2">
      <div>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Ban className="size-4 text-destructive" />
          Stufe 1 — Ausschluss (kein Prozentwert)
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Bei diesen Anforderungen gibt es kein „teilweise" — fällt eine, wird
          die Stelle dem Handwerker <strong>gar nicht angezeigt</strong>, statt
          ihn mit einem niedrigen Wert zu verwirren:
        </p>
        <ul className="mt-2 grid list-inside list-disc gap-0.5 text-sm sm:grid-cols-2">
          <li>Gewerk (akzeptierte Gewerke)</li>
          <li>Mindestabschluss</li>
          <li>Aufgaben-Mindestabdeckung (nur wenn &gt; 0)</li>
          <li>Führungsverantwortung</li>
          <li>Montagebereitschaft</li>
          <li>Deutsch-Mindestniveau</li>
          <li>Führerschein — nur bei „gar keiner"</li>
          <li>Gehalt — Budget unter Mindestwunsch</li>
          <li>
            Arbeitsradius des Handwerkers — geprüft gegen <em>alle</em> seine
            Arbeitsorte
          </li>
        </ul>
      </div>
      <div className="lg:border-l lg:pl-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Stufe 2 — Punktwertung (eine Formel für alles)
        </h2>
        <code className="mt-1.5 block rounded-md bg-muted px-3 py-2 font-mono text-xs">
          Score = 100 × (1 − Σ(Gewicht × (1 − Erfüllung)) / Σ Gewicht)
        </code>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gewichte.map(([key, wert]) => (
            <Badge key={key} variant="secondary" className="font-normal">
              {weightLabel(key)}{" "}
              <span className="ml-1 font-semibold text-primary">{wert}</span>
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Gewichte 0–5, pro Inserat übersteuerbar. <strong>Aufgabenbereiche
          sind das wichtigste Kriterium.</strong> Deutsch und Region sind keine
          gewichteten Kriterien — sie schließen aus (Stufe 1). Nicht
          beantwortete Fragen und nicht gestellte Anforderungen zählen weder im
          Zähler noch im Nenner; „Prioritäten" wird nur gewertet, wenn der
          Betrieb „Gebotenes" gepflegt hat.
        </p>
      </div>
    </section>
  );
}

/* ── Platzhalter, während die Engine-Bewertung läuft ───────────────────── */

function RankingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Breakdown-Tabelle (gemeinsam für beide Richtungen) ────────────────── */

function BreakdownTable({ breakdown }: { breakdown: MatchBreakdown }) {
  return (
    <div className="border-t px-4 py-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Kriterium</th>
              <th className="pb-2 font-medium">Gefordert</th>
              <th className="pb-2 font-medium">Angegeben</th>
              <th className="pb-2 text-right font-medium">Gewicht</th>
              <th className="pb-2 pl-4 font-medium">Erfüllung</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.criteria.map((z) => (
              <tr
                key={z.key}
                className={cn(
                  "border-t border-dashed",
                  z.skipped && "text-muted-foreground/60",
                )}
              >
                <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{z.label}</td>
                <td className="max-w-52 truncate py-1.5 pr-3" title={z.required}>
                  {z.required}
                </td>
                <td className="max-w-52 truncate py-1.5 pr-3" title={z.answer}>
                  {z.answer}
                </td>
                <td className="py-1.5 text-right tabular">{z.weight}</td>
                <td className="py-1.5 pl-4">
                  {z.skipped ? (
                    <span className="text-xs">nicht gewertet</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            z.fulfilment >= 0.8
                              ? "bg-success"
                              : z.fulfilment >= 0.4
                                ? "bg-primary"
                                : "bg-destructive",
                          )}
                          style={{ width: `${Math.round(z.fulfilment * 100)}%` }}
                        />
                      </span>
                      <span className="text-xs tabular">
                        {Math.round(z.fulfilment * 100)}%
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {breakdown.criteria.some((z) => !z.skipped && z.note) && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {breakdown.criteria
            .filter((z) => !z.skipped && z.note)
            .map((z) => (
              <li key={z.key}>
                <span className="font-medium">{z.label}:</span> {z.note}
              </li>
            ))}
        </ul>
      )}
      <p className="mt-2 font-mono text-xs text-muted-foreground/70">
        {breakdown.formula}
      </p>
    </div>
  );
}

function ScoreZeile({
  score,
  ohneKriterien,
}: {
  score: number;
  ohneKriterien: boolean;
}) {
  return (
    <span
      className={cn(
        "font-display w-16 shrink-0 text-2xl font-semibold tabular",
        ohneKriterien
          ? "text-muted-foreground/50"
          : score >= 80
            ? "text-success"
            : score >= 50
              ? "text-foreground"
              : "text-muted-foreground",
      )}
    >
      {score}%
    </span>
  );
}

/* ── Richtung 1: Kandidaten für einen Job ──────────────────────────────── */

async function JobDirection({ jobId }: { jobId: string }) {
  // Job-Query und Ranking sind unabhängig (Ranking nimmt die jobId, nicht den
  // Datensatz) → parallel statt seriell.
  const [[job], ranking] = await Promise.all([
    sql`
      select j.*, c.name as company_name
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.id = ${jobId} limit 1`,
    rankCandidatesForJob(jobId),
  ]);
  if (!job) {
    return <EmptyState title="Stelle nicht gefunden" />;
  }

  const criteriaFields: JobCriteriaFields = {
    gewerke: (job.gewerke as string[] | null) ?? null,
    berufe: (job.berufe as string[] | null) ?? null,
    abschlussMin: (job.abschlussMin as string | null) ?? null,
    meisterErwuenscht: (job.meisterErwuenscht as boolean | null) ?? null,
    aufgaben: (job.aufgaben as string[] | null) ?? null,
    aufgabenMin: (job.aufgabenMin as number | null) ?? null,
    bezeichnungTags: (job.bezeichnungTags as string[] | null) ?? null,
    gebotenes: (job.gebotenes as string[] | null) ?? null,
    startBis: (job.startBis as string | null) ?? null,
    erfahrungMin: (job.erfahrungMin as string | null) ?? null,
    erfahrungMax: (job.erfahrungMax as string | null) ?? null,
    fuehrungGefordert: (job.fuehrungGefordert as boolean | null) ?? null,
    deutschMin: (job.deutschMin as string | null) ?? null,
    fuehrerscheinMin: (job.fuehrerscheinMin as string | null) ?? null,
    montageMin: (job.montageMin as string | null) ?? null,
    budgetMonatCents: (job.budgetMonatCents as number | null) ?? null,
    city: (job.city as string | null) ?? null,
    gewichte: (job.gewichte as Record<string, unknown> | null) ?? null,
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold">
          <Link href={`/stellen/${jobId}`} className="hover:underline">
            {job.title as string}
          </Link>{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {(job.company_name as string) ?? "—"}
          </span>
        </h2>
        <Link
          href={`/stellen/${jobId}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Kriterien bearbeiten →
        </Link>
      </div>

      <IdealProfile job={criteriaFields} />

      {!ranking || ranking.bewertet.length === 0 ? (
        <EmptyState
          icon={UserSquare2}
          title="Keine bewertbaren Kandidaten"
          description="Entweder gibt es keine Kandidaten mit Matching-Profil, oder alle fallen durch die Ausschlusskriterien — Details unten."
        />
      ) : (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Kandidaten-Ranking{" "}
            <span className="font-normal text-muted-foreground">
              ({ranking.bewertet.length} bewertet)
            </span>
          </h3>
          {ranking.bewertet.map((k) => (
            <details key={k.applicationId} className="group rounded-lg border bg-card open:shadow-sm">
              <summary className="flex cursor-pointer items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ScoreZeile score={k.breakdown.score} ohneKriterien={k.ohneKriterien} />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/kandidaten/${k.applicationId}?tab=matching`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {k.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[k.profession, k.federalState].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                {k.ohneKriterien && (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    ohne bewertbare Kriterien
                  </Badge>
                )}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <BreakdownTable breakdown={k.breakdown} />
            </details>
          ))}
        </section>
      )}

      {ranking && ranking.ausgeschlossen.length > 0 && (
        <details className="group rounded-lg border border-dashed bg-card/50">
          <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <EyeOff className="size-4 text-muted-foreground" />
            {ranking.ausgeschlossen.length} Kandidaten ausgeschlossen (Stufe 1)
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            {ranking.ausgeschlossen.map((k) => (
              <div key={k.applicationId} className="rounded-md border bg-card px-3 py-2 text-sm">
                <Link href={`/kandidaten/${k.applicationId}`} className="font-medium hover:underline">
                  {k.name}
                </Link>
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {k.gruende.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {ranking && ranking.ohneProfil.length > 0 && (
        <details className="group rounded-lg border border-dashed bg-card/50">
          <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <UserSquare2 className="size-4 text-muted-foreground" />
            {ranking.ohneProfil.length} ohne Matching-Profil
            <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Registrierungsfragebogen nicht abgeschlossen oder kein
              Nutzerkonto zur E-Mail — ehrlicherweise ohne Score statt mit
              erfundenem.
            </p>
            <ul className="space-y-1 text-sm">
              {ranking.ohneProfil.map((k) => (
                <li key={k.applicationId}>
                  <Link href={`/kandidaten/${k.applicationId}`} className="hover:underline">
                    {k.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </>
  );
}

/* ── Richtung 2: Jobs für einen Kandidaten ─────────────────────────────── */

async function KandidatDirection({ kandidatId }: { kandidatId: string }) {
  const [kandidat] = await sql`
    select a.id, a."firstName", a."lastName", a.email, cm.aktiviert_at
    from admin.candidate a
    left join admin.candidate_meta cm on cm.application_id = a.id
    where a.id = ${kandidatId} and a.status <> 'ERASED' limit 1`;
  if (!kandidat) {
    return <EmptyState title="Kandidat nicht gefunden" />;
  }
  if (!kandidat.aktiviert_at) {
    return (
      <EmptyState
        icon={UserSquare2}
        title="Noch nicht aktiviert"
        description="Dieser Kandidat steht erst nach einem durchgeführten Telefonat im Callcenter (keine Sackgasse / kein Rückruf) fürs Matching zur Verfügung."
      />
    );
  }

  const wp = await ladeWorkerProfile({ email: kandidat.email as string });
  const ergebnis = await rankJobsForProfile(wp);
  if (ergebnis.profilLeer) {
    return (
      <EmptyState
        icon={UserSquare2}
        title="Kein Matching-Profil"
        description="Der Kandidat hat den Registrierungsfragebogen noch nicht abgeschlossen oder es gibt kein Nutzerkonto zu dieser E-Mail."
      />
    );
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold">
          {kandidat.firstName as string} {kandidat.lastName as string}
        </h2>
        <Link
          href={`/kandidaten/${kandidatId}?tab=matching`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Vollständiges Matching-Profil →
        </Link>
      </div>

      {ergebnis.ausgeblendet.gesamt > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          <EyeOff className="size-4" />
          {ergebnis.ausgeblendet.gesamt} Stellen werden diesem Kandidaten gar
          nicht angezeigt:
          {Object.entries(ergebnis.ausgeblendet.gruende).map(([grund, n]) => (
            <Badge key={grund} variant="secondary" className="font-normal">
              {grund} ({n})
            </Badge>
          ))}
        </p>
      )}

      {ergebnis.matches.length === 0 ? (
        <EmptyState
          title="Keine bewertbaren Stellen"
          description="Alle aktiven Stellen fallen durch Ausschlusskriterien oder es gibt keine."
        />
      ) : (
        <section className="space-y-2">
          {ergebnis.matches.map((m) => (
            <details key={m.jobId} className="group rounded-lg border bg-card open:shadow-sm">
              <summary className="flex cursor-pointer items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ScoreZeile score={m.breakdown.score} ohneKriterien={m.ohneKriterien} />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/stellen/${m.jobId}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {m.title}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3" />
                    {m.companyName ?? "—"}
                    {m.city && <span>· {m.city}</span>}
                  </span>
                </span>
                {m.ohneKriterien && (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    ohne bewertbare Kriterien
                  </Badge>
                )}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <BreakdownTable breakdown={m.breakdown} />
            </details>
          ))}
        </section>
      )}
    </>
  );
}
