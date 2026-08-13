import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  formatDate,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import {
  CANDIDATE_STATUS,
  APPLICATION_STATUS,
  JOB_APPLICATION_STATUS,
  TASK_STATUS,
  PRIORITIES,
  PRIORITY_LABELS,
  statusDef,
  type Priority,
} from "@/lib/definitions";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { Timeline, type TimelineEvent } from "@/components/common/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchingTab } from "./matching-tab";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileDown,
  FileText,
  History,
  Mail,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Phone,
  Pin,
  StickyNote,
  TriangleAlert,
  UserPlus,
  UserSquare2,
} from "lucide-react";
import { TagPicker } from "../../_shared/tag-picker";
import { FavoriteButton } from "../../_shared/favorite-button";
import type { Tag } from "../../_shared/tag-actions";
import {
  ActionSelect,
  CommunicationDialog,
  NoteDialog,
  TaskDialog,
} from "../_components/candidate-actions";
import {
  addCandidateNote,
  addCandidateTask,
  assignCandidate,
  logCandidateCommunication,
  updateCandidatePriority,
  updateCandidateStatus,
} from "../actions";

const PIPELINE_ORDER = [
  "NEU",
  "IN_BEARBEITUNG",
  "GEPRUEFT",
  "MATCHING",
  "VORGESCHLAGEN",
  "BEWERBUNG",
  "INTERVIEW",
  "ZUSAGE",
  "VERMITTELT",
  "ABGELEHNT",
  "INAKTIV",
];

const INTENT_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv suchend",
  PASSIVE: "Passiv",
};

const DOCUMENT_TYPES: Record<string, string> = {
  PHOTO: "Foto",
  CV: "Lebenslauf",
  QUALIFICATION: "Qualifikation",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-Mail",
  TELEFON: "Telefon",
  WHATSAPP: "WhatsApp",
  SONSTIGE: "Sonstige",
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

/** Aufbewahrungsfrist läuft in weniger als 60 Tagen ab? */
function isRetentionCritical(until: Date | null): boolean {
  if (!until) return false;
  return until.getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default async function KandidatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const employee = await requireEmployee("candidates");
  const { id } = await params;
  const { tab } = await searchParams;

  const candidates = await sql`
    select a.id, a."firstName", a."lastName", a.email, a.phone, a.profession,
           a."federalState", a."birthYear", a.availability,
           a."searchIntent"::text as "searchIntent", a.status::text as status,
           a.verified, a."verifiedAt", a."consentAt", a."createdAt", a."updatedAt",
           a."retentionUntil",
           cm.status as pipeline_status, cm.priority as pipeline_priority,
           cm.assignee_id, e.name as assignee_name, e.avatar_color as assignee_color
    from public."Application" a
    left join admin.candidate_meta cm on cm.application_id = a.id
    left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
    where a.id = ${id} and a.status <> 'ERASED'
    limit 1`;
  const c = candidates[0];
  if (!c) notFound();

  const [
    employees,
    documents,
    users,
    auditRows,
    notes,
    tasks,
    communications,
    appointments,
    settingRows,
    tagRows,
    favoriteRows,
  ] = await Promise.all([
    sql`select id, name from admin.employee
        where deleted_at is null and status = 'ACTIVE' order by name`,
    sql`select id, type::text as type, "originalName", "mimeType", "sizeBytes", "createdAt"
        from public."Document" where "applicationId" = ${id}
        order by "createdAt" desc`,
    sql`select id, "firstName", "lastName", email from public."User"
        where lower(email) = lower(${c.email as string}) limit 1`,
    sql`select al.id, al.action, al.metadata, al.created_at, e.name as actor_name
        from admin.audit_log al
        left join admin.employee e on e.id = al.actor_id
        where al.entity_type = 'candidate' and al.entity_id = ${id}
        order by al.created_at desc limit 100`,
    sql`select n.id, n.content, n.category, n.pinned, n.created_at, e.name as author_name
        from admin.note n
        left join admin.employee e on e.id = n.author_id
        where n.entity_type = 'candidate' and n.entity_id = ${id} and n.deleted_at is null
        order by n.pinned desc, n.created_at desc`,
    sql`select t.id, t.title, t.description, t.status, t.priority, t.due_at, t.created_at,
               e.name as assignee_name, e.avatar_color as assignee_color
        from admin.task t
        left join admin.employee e on e.id = t.assignee_id
        where t.entity_type = 'candidate' and t.entity_id = ${id} and t.deleted_at is null
        order by t.created_at desc`,
    sql`select k.id, k.channel, k.direction, k.subject, k.body, k.occurred_at,
               e.name as employee_name
        from admin.communication k
        left join admin.employee e on e.id = k.employee_id
        where k.entity_type = 'candidate' and k.entity_id = ${id} and k.deleted_at is null
        order by k.occurred_at desc`,
    sql`select a.id, a.title, a.starts_at, a.location, a.status, e.name as employee_name
        from admin.appointment a
        left join admin.employee e on e.id = a.employee_id
        where a.entity_type = 'candidate' and a.entity_id = ${id} and a.deleted_at is null
        order by a.starts_at desc`,
    sql`select value from admin.setting where key = 'note_categories'`,
    sql`select t.id, t.name, t.color
        from admin.tag t
        join admin.entity_tag et on et.tag_id = t.id
        where et.entity_type = 'candidate' and et.entity_id = ${id}
        order by t.name asc`,
    sql`select 1 as found from admin.favorite
        where employee_id = ${employee.id}
          and entity_type = 'candidate' and entity_id = ${id}`,
  ]);

  const linkedUser = users[0];
  const jobApplications = linkedUser
    ? await sql`
        select ja.id, ja.status::text as status, ja."createdAt",
               j.id as job_id, j.title as job_title,
               co.id as company_id, co.name as company_name
        from public."JobApplication" ja
        join public."JobPosting" j on j.id = ja."jobPostingId"
        left join public."Company" co on co.id = j."companyId"
        where ja."userId" = ${linkedUser.id as string}
        order by ja."createdAt" desc`
    : [];

  const noteCategories = Array.isArray(settingRows[0]?.value)
    ? (settingRows[0].value as string[])
    : FALLBACK_NOTE_CATEGORIES;

  const name = `${c.firstName} ${c.lastName}`;
  const pipelineStatus = (c.pipeline_status as string) ?? "NEU";
  const currentYear = new Date().getFullYear();
  const alter = c.birthYear ? `${currentYear - (c.birthYear as number)} Jahre` : "—";

  // ── Timeline zusammensetzen ─────────────────────────────────────────────
  const AUDIT_TITLES: Record<string, string> = {
    "candidate.status_changed": "Pipeline-Status geändert",
    "candidate.priority_changed": "Priorität geändert",
    "candidate.assigned": "Mitarbeiter zugewiesen",
  };
  const events: TimelineEvent[] = [
    {
      id: "registrierung",
      title: "Registrierung eingegangen",
      description: c.profession ? `Als ${c.profession}` : null,
      timestamp: c.createdAt as Date,
      icon: UserPlus,
      tone: "success" as const,
    },
    ...auditRows
      .filter((a) => AUDIT_TITLES[a.action as string])
      .map((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        let description: string | null = null;
        if (a.action === "candidate.status_changed" && meta.status) {
          description = `Neuer Status: ${statusDef(CANDIDATE_STATUS, String(meta.status)).label}`;
        } else if (a.action === "candidate.priority_changed" && meta.priority) {
          description = `Neue Priorität: ${PRIORITY_LABELS[meta.priority as Priority] ?? String(meta.priority)}`;
        }
        return {
          id: `audit-${a.id}`,
          title: AUDIT_TITLES[a.action as string],
          description,
          actor: (a.actor_name as string) ?? null,
          timestamp: a.created_at as Date,
          icon: History,
        } satisfies TimelineEvent;
      }),
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
    ...appointments.map(
      (a) =>
        ({
          id: `appt-${a.id}`,
          title: `Termin: ${a.title}`,
          description: a.location ? `Ort: ${a.location}` : null,
          actor: (a.employee_name as string) ?? null,
          timestamp: a.starts_at as Date,
          icon: CalendarDays,
        }) satisfies TimelineEvent,
    ),
    ...communications.map(
      (k) =>
        ({
          id: `comm-${k.id}`,
          title: `${CHANNEL_LABELS[k.channel as string] ?? k.channel} (${k.direction === "INBOUND" ? "eingehend" : "ausgehend"})`,
          description: (k.subject as string) ?? (k.body as string)?.slice(0, 160) ?? null,
          actor: (k.employee_name as string) ?? null,
          timestamp: k.occurred_at as Date,
          icon: MessagesSquare,
        }) satisfies TimelineEvent,
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const canEdit = can(employee, "candidates", "edit");
  const canAssign = can(employee, "candidates", "assign");
  const canExport = can(employee, "candidates", "export");

  const tags: Tag[] = tagRows.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: (t.color as string | null) ?? null,
  }));
  const isFavorite = favoriteRows.length > 0;

  // Aufbewahrungsfrist: Warnung, wenn das Ende weniger als 60 Tage entfernt ist.
  const retentionUntil = c.retentionUntil ? new Date(c.retentionUntil as Date) : null;
  const retentionCritical = isRetentionCritical(retentionUntil);

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/kandidaten" className="hover:text-foreground">
          Kandidaten
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{name}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Kopf */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {name}
            </h1>
            <FavoriteButton
              entityType="candidate"
              entityId={id}
              initialFavorited={isFavorite}
            />
            <StatusBadge map={CANDIDATE_STATUS} value={pipelineStatus} />
            <StatusBadge map={APPLICATION_STATUS} value={c.status as string} />
            <PriorityBadge value={c.pipeline_priority as string | null} />
            {Boolean(c.verified) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <BadgeCheck className="size-3.5" />
                Verifiziert
              </span>
            )}
          </div>
          <div className="mt-3">
            <TagPicker
              entityType="candidate"
              entityId={id}
              initialTags={tags}
              canEdit={canEdit}
            />
          </div>
          {retentionCritical && retentionUntil && (
            <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Aufbewahrungsfrist endet am{" "}
                <strong className="font-semibold tabular">
                  {formatDate(retentionUntil)}
                </strong>{" "}
                — danach greift die automatische Löschung der Plattform.
              </span>
            </p>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label="Beruf" value={c.profession as string} />
            <Fact label="Bundesland" value={c.federalState as string} />
            <Fact label="Alter" value={alter} />
            <Fact
              label="E-Mail"
              value={
                <a href={`mailto:${c.email}`} className="hover:text-primary">
                  {c.email as string}
                </a>
              }
            />
            <Fact
              label="Telefon"
              value={
                c.phone ? (
                  <a href={`tel:${c.phone}`} className="hover:text-primary">
                    {c.phone as string}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Fact label="Verfügbarkeit" value={c.availability as string} />
            <Fact
              label="Suchintention"
              value={
                c.searchIntent
                  ? (INTENT_LABELS[c.searchIntent as string] ?? c.searchIntent)
                  : "—"
              }
            />
            <Fact label="Registriert" value={formatDate(c.createdAt as Date)} />
          </dl>
        </div>

        {/* Aktionen */}
        <aside className="h-fit space-y-4 rounded-lg border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Aktionen
          </p>
          {canEdit ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Pipeline-Status</p>
              <ActionSelect
                entityId={id}
                value={pipelineStatus}
                options={PIPELINE_ORDER.map((s) => ({
                  value: s,
                  label: CANDIDATE_STATUS[s]?.label ?? s,
                }))}
                action={updateCandidateStatus}
              />
            </div>
          ) : null}
          {canEdit && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Priorität</p>
              <ActionSelect
                entityId={id}
                value={(c.pipeline_priority as string) ?? "NORMAL"}
                options={PRIORITIES.map((p) => ({
                  value: p,
                  label: PRIORITY_LABELS[p],
                }))}
                action={updateCandidatePriority}
              />
            </div>
          )}
          {canAssign && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Zuständiger Mitarbeiter</p>
              <ActionSelect
                entityId={id}
                value={(c.assignee_id as string) ?? null}
                emptyLabel="Niemand zugewiesen"
                options={employees.map((e) => ({
                  value: e.id as string,
                  label: e.name as string,
                }))}
                action={assignCandidate}
              />
            </div>
          )}
          {canEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Button asChild size="sm" className="w-full justify-start">
                <Link href={`/kandidaten/${id}/anruf`}>
                  <Phone className="size-3.5" />
                  Anruf starten
                </Link>
              </Button>
              <NoteDialog
                entityId={id}
                categories={noteCategories}
                action={addCandidateNote}
              />
              <TaskDialog
                entityId={id}
                employees={employees.map((e) => ({
                  id: e.id as string,
                  name: e.name as string,
                }))}
                currentEmployeeId={employee.id}
                action={addCandidateTask}
              />
              <CommunicationDialog
                entityId={id}
                action={logCandidateCommunication}
              />
            </div>
          )}
          {canExport && (
            <div className="border-t pt-3">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <a href={`/api/export/kandidat/${id}`}>
                  <FileDown className="size-3.5" />
                  DSGVO-Export
                </a>
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Alle gespeicherten Daten zu diesem Kandidaten als JSON.
              </p>
            </div>
          )}
          {!canEdit && !canAssign && (
            <p className="text-sm text-muted-foreground">
              Keine Bearbeitungsrechte für dieses Modul.
            </p>
          )}
        </aside>
      </div>

      <Tabs defaultValue={tab === "matching" ? "matching" : "uebersicht"} className="mt-6">
        <TabsList variant="line">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="matching">Job-Matching</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notizen">
            Notizen{notes.length > 0 ? ` (${notes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="aufgaben">
            Aufgaben{tasks.length > 0 ? ` (${tasks.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="kommunikation">
            Kommunikation
            {communications.length > 0 ? ` (${communications.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Übersicht */}
        <TabsContent value="uebersicht" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <UserSquare2 className="size-4 text-muted-foreground" />
                Stammdaten
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
                <Fact label="Vorname" value={c.firstName as string} />
                <Fact label="Nachname" value={c.lastName as string} />
                <Fact label="Geburtsjahr" value={c.birthYear as number} />
                <Fact
                  label="Verifiziert am"
                  value={c.verifiedAt ? formatDateTime(c.verifiedAt as Date) : "—"}
                />
                <Fact
                  label="Einwilligung"
                  value={c.consentAt ? formatDateTime(c.consentAt as Date) : "—"}
                />
                <Fact
                  label="Zuletzt aktualisiert"
                  value={formatRelative(c.updatedAt as Date)}
                />
              </dl>
            </section>

            <section className="rounded-lg border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Paperclip className="size-4 text-muted-foreground" />
                Dokumente
              </h2>
              {documents.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Keine Dokumente hochgeladen.
                </p>
              ) : (
                <ul className="mt-3 divide-y">
                  {documents.map((d) => (
                    <li key={d.id as string} className="flex items-center gap-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/api/dokumente/${d.id as string}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium hover:text-primary hover:underline"
                        >
                          {(d.originalName as string) ?? "Unbenannt"}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(d.sizeBytes as number)} ·{" "}
                          {formatDate(d.createdAt as Date)}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {DOCUMENT_TYPES[d.type as string] ?? d.type}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="size-4 text-muted-foreground" />
              Bewerbungen auf der Plattform
            </h2>
            {!linkedUser ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Kein Plattform-Account mit dieser E-Mail-Adresse gefunden.
              </p>
            ) : jobApplications.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Der verknüpfte Account hat sich noch auf keine Stelle beworben.
              </p>
            ) : (
              <ul className="mt-3 divide-y">
                {jobApplications.map((ja) => (
                  <li
                    key={ja.id as string}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                  >
                    <Link
                      href={`/bewerbungen/${ja.id}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {ja.job_title as string}
                    </Link>
                    {ja.company_name ? (
                      <Link
                        href={`/unternehmen/${ja.company_id}`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {ja.company_name as string}
                      </Link>
                    ) : null}
                    <span className="ml-auto flex items-center gap-3">
                      <StatusBadge
                        map={JOB_APPLICATION_STATUS}
                        value={ja.status as string}
                      />
                      <span className="text-xs text-muted-foreground tabular">
                        {formatDate(ja.createdAt as Date)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="matching" className="mt-4">
          <MatchingTab email={c.email as string} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-lg border bg-card p-5">
            {events.length === 0 ? (
              <EmptyState
                icon={History}
                title="Noch keine Aktivitäten"
                description="Statusänderungen, Notizen, Aufgaben und Termine erscheinen hier chronologisch."
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
                action={addCandidateNote}
              />
            </div>
          )}
          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title="Noch keine Notizen"
              description="Halte Gesprächsnotizen und Einschätzungen zu diesem Kandidaten fest."
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
                    {Boolean(n.pinned) && (
                      <Pin className="size-3.5 text-primary" />
                    )}
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
                action={addCandidateTask}
              />
            </div>
          )}
          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Keine Aufgaben"
              description="Lege Aufgaben an, um nichts zu diesem Kandidaten zu vergessen."
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

        {/* Kommunikation */}
        <TabsContent value="kommunikation" className="mt-4 space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <CommunicationDialog
                entityId={id}
                action={logCandidateCommunication}
              />
            </div>
          )}
          {communications.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Keine Kommunikation protokolliert"
              description="Logge Telefonate, E-Mails und Nachrichten, damit das Team den Überblick behält."
            />
          ) : (
            <ul className="space-y-3">
              {communications.map((k) => {
                const ChannelIcon =
                  k.channel === "EMAIL"
                    ? Mail
                    : k.channel === "TELEFON"
                      ? Phone
                      : MessageCircle;
                return (
                  <li key={k.id as string} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                        <ChannelIcon className="size-3.5 text-muted-foreground" />
                      </span>
                      <span className="text-sm font-medium">
                        {CHANNEL_LABELS[k.channel as string] ?? k.channel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {k.direction === "INBOUND" ? (
                          <>
                            <ArrowDownLeft className="size-3.5" /> eingehend
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="size-3.5" /> ausgehend
                          </>
                        )}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground tabular">
                        {formatDateTime(k.occurred_at as Date)}
                      </span>
                    </div>
                    {k.subject ? (
                      <p className="mt-2 text-sm font-medium">{k.subject as string}</p>
                    ) : null}
                    {k.body ? (
                      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                        {k.body as string}
                      </p>
                    ) : null}
                    {k.employee_name ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {k.employee_name as string}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
