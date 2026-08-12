import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  JOB_STATUS,
  JOB_APPLICATION_STATUS,
  JOB_OFFER_STATUS,
  TASK_STATUS,
  statusDef,
} from "@/lib/definitions";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { Timeline, type TimelineEvent } from "@/components/common/timeline";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  HandCoins,
  History,
  MapPin,
  Pin,
  StickyNote,
} from "lucide-react";
import { TagPicker } from "../../_shared/tag-picker";
import { FavoriteButton } from "../../_shared/favorite-button";
import type { Tag } from "../../_shared/tag-actions";
import { NoteDialog, TaskDialog } from "../_components/entity-actions";
import { EditJobSheet } from "../_components/edit-job-sheet";
import { IdealProfile } from "../_components/ideal-profile";
import {
  AUSBILDUNG_OPTIONS,
  DEUTSCH_OPTIONS,
  ERFAHRUNG_OPTIONS,
  FUEHRERSCHEIN_OPTIONS,
  levelLabel,
  type JobCriteriaFields,
} from "../_lib/job-criteria";
import { addJobNote, addJobTask, updateJob, type UpdateJobPayload } from "../actions";

const SOURCE_LABELS: Record<string, string> = {
  SELF: "Selbst erstellt",
  ADMIN: "Manuell angelegt",
  AI: "KI-Import",
};

const FALLBACK_NOTE_CATEGORIES = [
  "ALLGEMEIN",
  "BEWERBUNG",
  "INTERVIEW",
  "UNTERNEHMEN",
  "KOMMUNIKATION",
  "WICHTIG",
  "INTERN",
];

function formatSalary(min: number | null, max: number | null): string {
  const f = (v: number) => `${v.toLocaleString("de-DE")} €`;
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (min != null) return `ab ${f(min)}`;
  if (max != null) return `bis ${f(max)}`;
  return "—";
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function StellenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await requireEmployee("jobs");
  const { id } = await params;

  const jobs = await sql`
    select j.*, j.status::text as status_text, j.source::text as source_text,
           c.id as company_id, c.name as company_name
    from public."JobPosting" j
    left join public."Company" c on c.id = j."companyId"
    where j.id = ${id}
    limit 1`;
  const j = jobs[0];
  if (!j) notFound();

  const [
    applications,
    offers,
    employees,
    auditRows,
    notes,
    tasks,
    settingRows,
    tagRows,
    favoriteRows,
  ] = await Promise.all([
    sql`
      select ja.id, ja.status::text as status, ja."createdAt", ja."updatedAt",
             u."firstName", u."lastName", u.email, u.phone
      from public."JobApplication" ja
      left join public."User" u on u.id = ja."userId"
      where ja."jobPostingId" = ${id}
      order by ja."createdAt" desc`,
    sql`
      select o.id, o.status::text as status, o."createdAt", o.message,
             o."contactPerson", o."declineReason",
             u."firstName", u."lastName", u.email
      from public."JobOffer" o
      left join public."User" u on u.id = o."userId"
      where o."jobPostingId" = ${id}
      order by o."createdAt" desc`,
    sql`select id, name from admin.employee
        where deleted_at is null and status = 'ACTIVE' order by name`,
    sql`select al.id, al.action, al.metadata, al.created_at, e.name as actor_name
        from admin.audit_log al
        left join admin.employee e on e.id = al.actor_id
        where al.entity_type = 'job' and al.entity_id = ${id}
        order by al.created_at desc limit 100`,
    sql`select n.id, n.content, n.category, n.pinned, n.created_at, e.name as author_name
        from admin.note n
        left join admin.employee e on e.id = n.author_id
        where n.entity_type = 'job' and n.entity_id = ${id} and n.deleted_at is null
        order by n.pinned desc, n.created_at desc`,
    sql`select t.id, t.title, t.description, t.status, t.priority, t.due_at, t.created_at,
               e.name as assignee_name, e.avatar_color as assignee_color
        from admin.task t
        left join admin.employee e on e.id = t.assignee_id
        where t.entity_type = 'job' and t.entity_id = ${id} and t.deleted_at is null
        order by t.created_at desc`,
    sql`select value from admin.setting where key = 'note_categories'`,
    sql`select t.id, t.name, t.color
        from admin.tag t
        join admin.entity_tag et on et.tag_id = t.id
        where et.entity_type = 'job' and et.entity_id = ${id}
        order by t.name asc`,
    sql`select 1 as found from admin.favorite
        where employee_id = ${employee.id}
          and entity_type = 'job' and entity_id = ${id}`,
  ]);

  const noteCategories = Array.isArray(settingRows[0]?.value)
    ? (settingRows[0].value as string[])
    : FALLBACK_NOTE_CATEGORIES;

  const gewichte =
    j.gewichte && typeof j.gewichte === "object" && !Array.isArray(j.gewichte)
      ? (j.gewichte as Record<string, unknown>)
      : null;
  const aufgaben = Array.isArray(j.aufgaben) ? (j.aufgaben as string[]) : [];
  const gebotenes = Array.isArray(j.gebotenes) ? (j.gebotenes as string[]) : [];

  const erfahrung =
    j.erfahrungMin || j.erfahrungMax
      ? [j.erfahrungMin, j.erfahrungMax]
          .filter((v): v is string => Boolean(v))
          .map((v) => levelLabel(ERFAHRUNG_OPTIONS, v))
          .join(" – ")
      : "—";

  const criteriaFields: JobCriteriaFields = {
    berufe: (j.berufe as string[] | null) ?? null,
    bereiche: (j.bereiche as string[] | null) ?? null,
    aufgaben: (j.aufgaben as string[] | null) ?? null,
    aufgabenMin: (j.aufgabenMin as number | null) ?? null,
    erfahrungMin: (j.erfahrungMin as string | null) ?? null,
    erfahrungMax: (j.erfahrungMax as string | null) ?? null,
    ausbildungMin: (j.ausbildungMin as string | null) ?? null,
    deutschMin: (j.deutschMin as string | null) ?? null,
    fuehrerscheinMin: (j.fuehrerscheinMin as string | null) ?? null,
    montageMin: (j.montageMin as string | null) ?? null,
    city: (j.city as string | null) ?? null,
    gewichte: gewichte as Record<string, unknown> | null,
  };

  const editPayload: UpdateJobPayload = {
    title: (j.title as string) ?? "",
    status: (j.status_text as string) ?? "DRAFT",
    city: (j.city as string) ?? "",
    description: (j.description as string) ?? "",
    salaryMin: (j.salaryMin as number | null) ?? null,
    salaryMax: (j.salaryMax as number | null) ?? null,
    urlaubstage: (j.urlaubstage as number | null) ?? null,
    montage: (j.montage as string) ?? "",
    gewerk: (j.gewerk as string) ?? "",
    berufe: (j.berufe as string[] | null) ?? [],
    bereiche: (j.bereiche as string[] | null) ?? [],
    erfahrungMin: (j.erfahrungMin as string | null) ?? null,
    erfahrungMax: (j.erfahrungMax as string | null) ?? null,
    ausbildungMin: (j.ausbildungMin as string | null) ?? null,
    deutschMin: (j.deutschMin as string | null) ?? null,
    fuehrerscheinMin: (j.fuehrerscheinMin as string | null) ?? null,
    montageMin: (j.montageMin as string | null) ?? null,
    gewichte: Object.fromEntries(
      Object.entries(gewichte ?? {})
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => Number.isFinite(v)),
    ),
  };

  // ── Timeline ────────────────────────────────────────────────────────────
  const events: TimelineEvent[] = [
    {
      id: "erstellt",
      title: "Stellenanzeige erstellt",
      description: j.source_text
        ? `Quelle: ${SOURCE_LABELS[j.source_text as string] ?? j.source_text}`
        : null,
      timestamp: j.createdAt as Date,
      icon: Briefcase,
      tone: "success" as const,
    },
    ...auditRows
      .filter((a) => !String(a.action).endsWith("note_added") && !String(a.action).endsWith("task_created"))
      .map(
        (a) =>
          ({
            id: `audit-${a.id}`,
            title:
              a.action === "job.updated"
                ? "Stellenanzeige bearbeitet"
                : String(a.action),
            description:
              a.action === "job.updated" &&
              a.metadata &&
              typeof a.metadata === "object" &&
              (a.metadata as { diff?: Record<string, unknown> }).diff
                ? `Geänderte Felder: ${Object.keys(
                    (a.metadata as { diff: Record<string, unknown> }).diff,
                  ).join(", ")}`
                : null,
            actor: (a.actor_name as string) ?? null,
            timestamp: a.created_at as Date,
            icon: History,
          }) satisfies TimelineEvent,
      ),
    ...notes.map(
      (n) =>
        ({
          id: `note-${n.id}`,
          title: `Notiz (${n.category ?? "Allgemein"})`,
          description: (n.content as string).slice(0, 200),
          actor: (n.author_name as string) ?? null,
          timestamp: n.created_at as Date,
          icon: StickyNote,
        }) satisfies TimelineEvent,
    ),
    ...tasks.map(
      (t) =>
        ({
          id: `task-${t.id}`,
          title: `Aufgabe: ${t.title}`,
          description: `Status: ${statusDef(TASK_STATUS, t.status as string).label}`,
          actor: (t.assignee_name as string) ?? null,
          timestamp: t.created_at as Date,
          icon: ClipboardList,
        }) satisfies TimelineEvent,
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const canEdit = can(employee, "jobs", "edit");

  const tags: Tag[] = tagRows.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: (t.color as string | null) ?? null,
  }));
  const isFavorite = favoriteRows.length > 0;

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/stellen" className="hover:text-foreground">
          Stellenanzeigen
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="line-clamp-1 font-medium text-foreground">
          {j.title as string}
        </span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {j.title as string}
            </h1>
            <FavoriteButton
              entityType="job"
              entityId={id}
              initialFavorited={isFavorite}
            />
            <StatusBadge map={JOB_STATUS} value={j.status_text as string} />
          </div>
          <div className="mt-3">
            <TagPicker
              entityType="job"
              entityId={id}
              initialTags={tags}
              canEdit={canEdit}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {j.company_id ? (
              <Link
                href={`/unternehmen/${j.company_id}`}
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
              >
                <Building2 className="size-4" />
                {j.company_name as string}
              </Link>
            ) : null}
            {j.city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {j.city as string}
              </span>
            ) : null}
            {j.gewerk ? <span>{j.gewerk as string}</span> : null}
            {j.source_text ? (
              <Badge variant="secondary">
                {SOURCE_LABELS[j.source_text as string] ?? j.source_text}
              </Badge>
            ) : null}
            <span className="tabular">Erstellt {formatDate(j.createdAt as Date)}</span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-4">
            <Fact
              label="Gehalt"
              value={
                <span className="inline-flex items-center gap-1.5 tabular">
                  <HandCoins className="size-3.5 text-muted-foreground" />
                  {formatSalary(
                    j.salaryMin as number | null,
                    j.salaryMax as number | null,
                  )}
                </span>
              }
            />
            <Fact label="Montage" value={j.montage as string} />
            <Fact
              label="Urlaubstage"
              value={j.urlaubstage != null ? `${j.urlaubstage} Tage` : "—"}
            />
            <Fact label="Erfahrung" value={erfahrung} />
            <Fact
              label="Ausbildung (min.)"
              value={
                j.ausbildungMin
                  ? levelLabel(AUSBILDUNG_OPTIONS, j.ausbildungMin as string)
                  : "—"
              }
            />
            <Fact
              label="Deutsch-Level (min.)"
              value={
                j.deutschMin
                  ? levelLabel(DEUTSCH_OPTIONS, j.deutschMin as string)
                  : "—"
              }
            />
            <Fact
              label="Führerschein (min.)"
              value={
                j.fuehrerscheinMin
                  ? levelLabel(FUEHRERSCHEIN_OPTIONS, j.fuehrerscheinMin as string)
                  : "—"
              }
            />
          </dl>
        </div>

        <aside className="h-fit space-y-3 rounded-lg border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Aktionen
          </p>
          {canEdit ? (
            <div className="flex flex-col gap-2">
              <EditJobSheet jobId={id} initial={editPayload} action={updateJob} />
              <NoteDialog
                entityId={id}
                categories={noteCategories}
                action={addJobNote}
              />
              <TaskDialog
                entityId={id}
                employees={employees.map((e) => ({
                  id: e.id as string,
                  name: e.name as string,
                }))}
                currentEmployeeId={employee.id}
                action={addJobTask}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Bearbeitungsrechte für dieses Modul.
            </p>
          )}
        </aside>
      </div>

      {(j.description || aufgaben.length > 0 || gebotenes.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {j.description ? (
            <section className="rounded-lg border bg-card p-5 lg:col-span-1">
              <h2 className="text-sm font-semibold">Beschreibung</h2>
              <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">
                {j.description as string}
              </p>
            </section>
          ) : null}
          {aufgaben.length > 0 && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Aufgaben</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {aufgaben.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.75 size-1 shrink-0 rounded-full bg-primary" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {gebotenes.length > 0 && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Das wird geboten</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {gebotenes.map((g, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.75 size-1 shrink-0 rounded-full bg-success" />
                    {g}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <IdealProfile
        job={criteriaFields}
        className="mt-4"
        emptyAction={
          canEdit ? (
            <EditJobSheet
              jobId={id}
              initial={editPayload}
              action={updateJob}
              triggerLabel="Kriterien bearbeiten"
              triggerVariant="default"
            />
          ) : undefined
        }
      />

      <Tabs defaultValue="bewerbungen" className="mt-6">
        <TabsList variant="line">
          <TabsTrigger value="bewerbungen">
            Bewerbungen{applications.length > 0 ? ` (${applications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="angebote">
            Angebote{offers.length > 0 ? ` (${offers.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notizen">
            Notizen{notes.length > 0 ? ` (${notes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="aufgaben">
            Aufgaben{tasks.length > 0 ? ` (${tasks.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Bewerbungen */}
        <TabsContent value="bewerbungen" className="mt-4">
          {applications.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Noch keine Bewerbungen"
              description="Sobald sich Handwerker auf diese Stelle bewerben, erscheinen sie hier."
            />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {applications.map((a) => (
                <li
                  key={a.id as string}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <Link
                    href={`/bewerbungen/${a.id}`}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {a.firstName || a.lastName
                      ? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()
                      : ((a.email as string) ?? "Unbekannt")}
                  </Link>
                  {a.email ? (
                    <span className="text-sm text-muted-foreground">
                      {a.email as string}
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-3">
                    <StatusBadge
                      map={JOB_APPLICATION_STATUS}
                      value={a.status as string}
                    />
                    <span className="text-xs text-muted-foreground tabular">
                      {formatDate(a.createdAt as Date)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Angebote */}
        <TabsContent value="angebote" className="mt-4">
          {offers.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Keine Angebote"
              description="Das Unternehmen hat für diese Stelle noch keine Angebote an Handwerker verschickt."
            />
          ) : (
            <ul className="space-y-3">
              {offers.map((o) => (
                <li key={o.id as string} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-sm font-medium">
                      {o.firstName || o.lastName
                        ? `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim()
                        : ((o.email as string) ?? "Unbekannt")}
                    </span>
                    {o.contactPerson ? (
                      <span className="text-xs text-muted-foreground">
                        Ansprechpartner: {o.contactPerson as string}
                      </span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-3">
                      <StatusBadge map={JOB_OFFER_STATUS} value={o.status as string} />
                      <span className="text-xs text-muted-foreground tabular">
                        {formatDate(o.createdAt as Date)}
                      </span>
                    </span>
                  </div>
                  {o.message ? (
                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                      {o.message as string}
                    </p>
                  ) : null}
                  {o.declineReason ? (
                    <p className="mt-2 text-sm text-destructive">
                      Ablehnungsgrund: {o.declineReason as string}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-lg border bg-card p-5">
            {events.length === 0 ? (
              <EmptyState
                icon={History}
                title="Noch keine Aktivitäten"
                description="Änderungen, Notizen und Aufgaben zu dieser Stelle erscheinen hier."
                className="border-0"
              />
            ) : (
              <Timeline events={events} />
            )}
          </div>
        </TabsContent>

        {/* Notizen */}
        <TabsContent value="notizen" className="mt-4 space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <NoteDialog
                entityId={id}
                categories={noteCategories}
                action={addJobNote}
              />
            </div>
          )}
          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title="Noch keine Notizen"
              description="Halte Besonderheiten zu dieser Stelle fest."
            />
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id as string} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {((n.category as string) ?? "ALLGEMEIN").charAt(0) +
                        ((n.category as string) ?? "ALLGEMEIN").slice(1).toLowerCase()}
                    </Badge>
                    {Boolean(n.pinned) && <Pin className="size-3.5 text-primary" />}
                    <span className="ml-auto text-xs text-muted-foreground tabular">
                      {formatDateTime(n.created_at as Date)}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm whitespace-pre-wrap">
                    {n.content as string}
                  </p>
                  {n.author_name ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.author_name as string}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Aufgaben */}
        <TabsContent value="aufgaben" className="mt-4 space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <TaskDialog
                entityId={id}
                employees={employees.map((e) => ({
                  id: e.id as string,
                  name: e.name as string,
                }))}
                currentEmployeeId={employee.id}
                action={addJobTask}
              />
            </div>
          )}
          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Keine Aufgaben"
              description="Lege Aufgaben zu dieser Stelle an."
            />
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li
                  key={t.id as string}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.title as string}</p>
                    {t.description ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {t.description as string}
                      </p>
                    ) : null}
                    {t.due_at ? (
                      <p className="mt-1 text-xs text-muted-foreground tabular">
                        Fällig: {formatDateTime(t.due_at as Date)}
                      </p>
                    ) : null}
                  </div>
                  <PriorityBadge value={t.priority as string} />
                  <StatusBadge map={TASK_STATUS} value={t.status as string} />
                  <EmployeeAvatar
                    name={t.assignee_name as string | null}
                    color={t.assignee_color as string | null}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
