import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import {
  ArrowRight,
  Briefcase,
  Check,
  Gauge,
  ListChecks,
  MapPin,
  MessageSquareText,
  ShieldX,
  SlidersHorizontal,
  Sparkles,
  UserSquare2,
} from "lucide-react";
import { ParamSelect } from "./_components/param-select";
// Wiederverwendung der Ideal-Profil-Karte aus dem Stellen-Modul —
// Import aus fremdem Modulordner ist hier laut Auftrag ausdrücklich erlaubt.
import { IdealProfile } from "../stellen/_components/ideal-profile";
import {
  buildIdealProfile,
  type JobCriteriaFields,
} from "../stellen/_lib/job-criteria";

const PIPELINE_STEPS = [
  {
    icon: Gauge,
    title: "Score (0–100)",
    text: "Die Engine berechnet je Kandidat-Job-Paar einen gewichteten Gesamtscore.",
  },
  {
    icon: ListChecks,
    title: "Kriterien",
    text: "Beruf, Erfahrung, Deutsch, Führerschein und Region — gewichtet nach dem Stellenprofil.",
  },
  {
    icon: MessageSquareText,
    title: "Reasons",
    text: "Jeder Score wird mit nachvollziehbaren Gründen pro Kriterium erklärt.",
  },
  {
    icon: ShieldX,
    title: "Exclusions",
    text: "Harte K.-o.-Kriterien schließen unpassende Kandidaten sicher aus.",
  },
  {
    icon: SlidersHorizontal,
    title: "Override",
    text: "Mitarbeiter können Ergebnisse manuell übersteuern — protokolliert im Audit-Log.",
  },
] as const;

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("matching");
  const params = await searchParams;

  const mode =
    firstParam(params.modus) === "kandidat" || firstParam(params.kandidat)
      ? "kandidat"
      : "job";
  const jobId = firstParam(params.job);
  const kandidatId = firstParam(params.kandidat);

  return (
    <>
      <PageHeader
        title="Matching-Center"
        description="Kandidaten und Stellen zusammenbringen. Die KI-Scoring-Engine ist vorbereitet — bis dahin liefert die regelbasierte Vorauswahl erste Treffer."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Sparkles className="size-3.5" />
            Engine vorbereitet
          </span>
        }
      />

      <div className="mb-5 inline-flex rounded-lg border bg-card p-1">
        <Link
          href="/matching"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "job"
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Briefcase className="size-4" />
          Kandidaten für Job
        </Link>
        <Link
          href="/matching?modus=kandidat"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "kandidat"
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <UserSquare2 className="size-4" />
          Beste Jobs für Kandidat
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {mode === "job" ? (
            <JobDirection jobId={jobId} />
          ) : (
            <CandidateDirection kandidatId={kandidatId} />
          )}
        </div>

        <aside className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              So wird gematcht
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Geplante Scoring-Pipeline der Matching-Engine
            </p>
          </div>
          <ol className="space-y-4 p-4">
            {PIPELINE_STEPS.map((step) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <step.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}

/* ── Richtung 1: Kandidaten für einen Job ──────────────────────────────── */

async function JobDirection({ jobId }: { jobId: string | undefined }) {
  const jobs = await sql`
    select j.id, j.title, c.name as company_name
    from public."JobPosting" j
    left join public."Company" c on c.id = j."companyId"
    where j.status = 'ACTIVE'
    order by j."createdAt" desc
    limit 200`;

  const jobOptions = jobs.map((j) => ({
    value: j.id as string,
    label: `${j.title as string}${j.company_name ? ` — ${j.company_name as string}` : ""}`,
  }));

  const job = jobId
    ? (
        await sql`
          select j.*, c.name as company_name
          from public."JobPosting" j
          left join public."Company" c on c.id = j."companyId"
          where j.id = ${jobId}
          limit 1`
      )[0]
    : undefined;

  return (
    <>
      <div className="rounded-lg border bg-card p-4">
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Job wählen
        </label>
        {jobOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aktuell gibt es keine aktiven Stellenanzeigen.
          </p>
        ) : (
          <ParamSelect
            param="job"
            placeholder="Aktive Stellenanzeige auswählen…"
            options={jobOptions}
          />
        )}
      </div>

      {!job && jobId && (
        <EmptyState
          title="Stellenanzeige nicht gefunden"
          description="Die gewählte Stelle existiert nicht mehr oder ist nicht aktiv."
        />
      )}

      {!jobId && (
        <EmptyState
          icon={Briefcase}
          title="Keine Stelle ausgewählt"
          description="Wähle oben eine aktive Stellenanzeige, um Anforderungen und die regelbasierte Kandidaten-Vorauswahl zu sehen."
        />
      )}

      {job && (
        <>
          <IdealProfile job={toCriteriaFields(job)} />
          <CandidateSuggestions job={job} />
        </>
      )}
    </>
  );
}

function toCriteriaFields(job: Record<string, unknown>): JobCriteriaFields {
  return {
    berufe: (job.berufe as string[] | null) ?? null,
    bereiche: (job.bereiche as string[] | null) ?? null,
    aufgaben: (job.aufgaben as string[] | null) ?? null,
    aufgabenMin: (job.aufgabenMin as number | null) ?? null,
    erfahrungMin: (job.erfahrungMin as string | null) ?? null,
    erfahrungMax: (job.erfahrungMax as string | null) ?? null,
    ausbildungMin: (job.ausbildungMin as string | null) ?? null,
    deutschMin: (job.deutschMin as string | null) ?? null,
    fuehrerscheinMin: (job.fuehrerscheinMin as string | null) ?? null,
    montageMin: (job.montageMin as string | null) ?? null,
    city: (job.city as string | null) ?? null,
    gewichte: (job.gewichte as Record<string, unknown> | null) ?? null,
  };
}

/** Erfüllt (grüner Haken) oder nicht erfüllt/unbekannt (grauer Punkt). */
function CriterionChip({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        met
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {met ? (
        <Check className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
      )}
      {label}
    </span>
  );
}

async function CandidateSuggestions({ job }: { job: Record<string, unknown> }) {
  const terms = [
    ...((job.berufe as string[] | null) ?? []),
    ...(job.gewerk ? [job.gewerk as string] : []),
  ].filter(Boolean);

  const patterns = terms.map((t) => `%${t}%`);

  const candidates =
    patterns.length === 0
      ? []
      : await sql`
          select a.id, a."firstName", a."lastName", a.profession, a."federalState",
                 a.verified,
                 coalesce(cm.status, 'NEU') as pipeline_status
          from public."Application" a
          left join admin.candidate_meta cm on cm.application_id = a.id
          where a.status <> 'ERASED'
            and a.profession is not null
            and a.profession ilike any(${patterns})
          order by a."createdAt" desc
          limit 25`;

  // Nur diese Kriterien lassen sich ehrlich aus den Application-Feldern
  // ableiten — alle übrigen Job-Kriterien bleiben „unbekannt".
  const profileRows = buildIdealProfile(toCriteriaFields(job));
  const unknownCriteria = profileRows
    .filter((r) => r.key !== "beruf")
    .map((r) => r.label);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Basis-Vorauswahl (regelbasiert)
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          <Sparkles className="size-3" />
          Vorauswahl — KI-Score folgt
        </span>
        {candidates.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular">
            {candidates.length} Treffer
          </span>
        )}
      </div>
      {terms.length === 0 ? (
        <EmptyState
          title="Keine Suchkriterien hinterlegt"
          description="Die Stelle hat weder Berufe noch ein Gewerk — ohne Kriterien ist keine Vorauswahl möglich."
          className="border-0"
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Keine passenden Kandidaten"
          description={`Kein Kandidatenberuf passt aktuell auf: ${terms.join(", ")}.`}
          className="border-0"
        />
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {candidates.map((c) => {
              const profession = (c.profession as string | null) ?? "";
              const berufOk =
                profession.length > 0 &&
                terms.some((t) =>
                  profession.toLowerCase().includes(t.toLowerCase()),
                );
              const hasState = Boolean(c.federalState);
              const isVerified = Boolean(c.verified);
              return (
                <li key={c.id as string}>
                  <Link
                    href={`/kandidaten/${c.id}`}
                    className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.firstName as string} {c.lastName as string}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profession || "—"}
                        {c.federalState ? ` · ${c.federalState as string}` : ""}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <CriterionChip met={berufOk} label="Beruf" />
                        <CriterionChip
                          met={hasState}
                          label={
                            hasState
                              ? `Bundesland: ${c.federalState as string}`
                              : "Bundesland unbekannt"
                          }
                        />
                        <CriterionChip met={isVerified} label="Verifiziert" />
                      </p>
                    </div>
                    <StatusBadge
                      map={CANDIDATE_STATUS}
                      value={c.pipeline_status as string}
                    />
                    <ArrowRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {unknownCriteria.length > 0 && (
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              Grauer Punkt = nicht erfüllt oder unbekannt. Aus dem
              Registrierungsprofil nicht ableitbar (erst mit der
              Matching-Engine): {unknownCriteria.join(", ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Richtung 2: Beste Jobs für einen Kandidaten ───────────────────────── */

async function CandidateDirection({
  kandidatId,
}: {
  kandidatId: string | undefined;
}) {
  const candidates = await sql`
    select id, "firstName", "lastName", profession
    from public."Application"
    where status <> 'ERASED'
    order by "createdAt" desc
    limit 200`;

  const candidateOptions = candidates.map((c) => ({
    value: c.id as string,
    label: `${c.firstName as string} ${c.lastName as string}${
      c.profession ? ` — ${c.profession as string}` : ""
    }`,
  }));

  const candidate = kandidatId
    ? (
        await sql`
          select id, "firstName", "lastName", profession, "federalState"
          from public."Application"
          where id = ${kandidatId} and status <> 'ERASED'
          limit 1`
      )[0]
    : undefined;

  const profession = (candidate?.profession as string | null) ?? null;
  const pattern = profession ? `%${profession}%` : null;

  const matchingJobs =
    candidate && pattern
      ? await sql`
          select j.id, j.title, j.gewerk, j.city, c.name as company_name
          from public."JobPosting" j
          left join public."Company" c on c.id = j."companyId"
          where j.status = 'ACTIVE'
            and (
              j.title ilike ${pattern}
              or j.gewerk ilike ${pattern}
              or exists (
                select 1 from unnest(coalesce(j.berufe, '{}')) as b(beruf)
                where b.beruf ilike ${pattern}
                   or ${profession} ilike '%' || b.beruf || '%'
              )
            )
          order by j."createdAt" desc
          limit 25`
      : [];

  return (
    <>
      <div className="rounded-lg border bg-card p-4">
        <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Kandidat wählen
        </label>
        {candidateOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Es sind noch keine Kandidaten registriert.
          </p>
        ) : (
          <ParamSelect
            param="kandidat"
            placeholder="Kandidat auswählen…"
            options={candidateOptions}
          />
        )}
      </div>

      {!kandidatId && (
        <EmptyState
          icon={UserSquare2}
          title="Kein Kandidat ausgewählt"
          description="Wähle oben einen Kandidaten, um passende aktive Stellenanzeigen zu finden."
        />
      )}

      {kandidatId && !candidate && (
        <EmptyState
          title="Kandidat nicht gefunden"
          description="Der gewählte Kandidat existiert nicht mehr."
        />
      )}

      {candidate && (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              Passende aktive Jobs
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              <Sparkles className="size-3" />
              Vorauswahl — KI-Score folgt
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              für {candidate.firstName as string} {candidate.lastName as string}
              {profession ? ` (${profession})` : ""}
            </span>
          </div>
          {!profession ? (
            <EmptyState
              title="Kein Beruf hinterlegt"
              description="Ohne Berufsangabe des Kandidaten ist keine regelbasierte Vorauswahl möglich."
              className="border-0"
            />
          ) : matchingJobs.length === 0 ? (
            <EmptyState
              title="Keine passenden Jobs"
              description={`Aktuell passt keine aktive Stelle auf den Beruf „${profession}“.`}
              className="border-0"
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {matchingJobs.map((j) => (
                <li key={j.id as string}>
                  <Link
                    href={`/stellen/${j.id}`}
                    className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {j.title as string}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(j.company_name as string | null) ?? "Ohne Unternehmen"}
                        {j.gewerk ? ` · ${j.gewerk as string}` : ""}
                      </p>
                    </div>
                    {j.city && (
                      <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                        <MapPin className="size-3" />
                        {j.city as string}
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
