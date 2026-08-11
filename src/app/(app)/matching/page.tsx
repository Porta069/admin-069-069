import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Briefcase,
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

const WEIGHT_LABELS: Record<string, string> = {
  beruf: "Beruf / Gewerk",
  berufe: "Beruf / Gewerk",
  gewerk: "Gewerk",
  erfahrung: "Berufserfahrung",
  ausbildung: "Ausbildung",
  deutsch: "Deutschkenntnisse",
  fuehrerschein: "Führerschein",
  region: "Region / Entfernung",
  entfernung: "Entfernung",
  verfuegbarkeit: "Verfügbarkeit",
};

function weightLabel(key: string): string {
  const known = WEIGHT_LABELS[key.toLowerCase()];
  if (known) return known;
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

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
          <JobRequirements job={job} />
          <CandidateSuggestions job={job} />
        </>
      )}
    </>
  );
}

function JobRequirements({ job }: { job: Record<string, unknown> }) {
  const bereiche = (job.bereiche as string[] | null) ?? [];
  const berufe = (job.berufe as string[] | null) ?? [];
  const gewichte = (job.gewichte as Record<string, unknown> | null) ?? {};
  const weightEntries = Object.entries(gewichte);

  const facts: { label: string; value: string }[] = [
    {
      label: "Erfahrung",
      value:
        job.erfahrungMin != null || job.erfahrungMax != null
          ? `${job.erfahrungMin ?? 0}–${job.erfahrungMax ?? "∞"} Jahre`
          : "—",
    },
    { label: "Deutsch min.", value: String(job.deutschMin ?? "—") },
    { label: "Führerschein min.", value: String(job.fuehrerscheinMin ?? "—") },
    { label: "Ausbildung min.", value: String(job.ausbildungMin ?? "—") },
  ];

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Anforderungsprofil
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {job.title as string}
          {job.company_name ? ` · ${job.company_name as string}` : ""}
          {job.city ? ` · ${job.city as string}` : ""}
        </p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Bereiche
            </p>
            {bereiche.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bereiche.map((b) => (
                  <Badge key={b} variant="secondary">
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Berufe
            </p>
            {berufe.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {berufe.map((b) => (
                  <Badge key={b} variant="secondary">
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium tabular">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Matching-Gewichte
          </p>
          {weightEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Für diese Stelle sind keine Gewichte hinterlegt.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 font-medium">Kriterium</th>
                  <th className="py-1.5 text-right font-medium">Gewicht</th>
                </tr>
              </thead>
              <tbody>
                {weightEntries.map(([key, value]) => (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5">{weightLabel(key)}</td>
                    <td className="py-1.5 text-right font-medium tabular">
                      {String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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
                 coalesce(cm.status, 'NEU') as pipeline_status
          from public."Application" a
          left join admin.candidate_meta cm on cm.application_id = a.id
          where a.status <> 'ERASED'
            and a.profession is not null
            and a.profession ilike any(${patterns})
          order by a."createdAt" desc
          limit 25`;

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
        <ul className="divide-y divide-border/60">
          {candidates.map((c) => (
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
                    {(c.profession as string | null) ?? "—"}
                    {c.federalState ? ` · ${c.federalState as string}` : ""}
                  </p>
                </div>
                <StatusBadge
                  map={CANDIDATE_STATUS}
                  value={c.pipeline_status as string}
                />
                <ArrowRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
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
