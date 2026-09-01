import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  COMPANY_STATUS,
  JOB_STATUS,
  JOB_APPLICATION_STATUS,
  JOB_OFFER_STATUS,
  TASK_STATUS,
  statusDef,
  type StatusDef,
} from "@/lib/definitions";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { Timeline, type TimelineEvent } from "@/components/common/timeline";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe,
  History,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Pin,
  StickyNote,
  User,
  Users,
  BadgeCheck,
  Inbox,
  Sparkles,
} from "lucide-react";
import { AssigneeSelect } from "@/components/common/assignee-select";
import { TagPicker } from "../../_shared/tag-picker";
import { FavoriteButton } from "../../_shared/favorite-button";
import type { Tag } from "../../_shared/tag-actions";
import {
  ActionSelect,
  CommunicationDialog,
  NoteDialog,
  TaskDialog,
} from "../_components/entity-actions";
import {
  DeleteCompanyDialog,
  RestoreCompanyButton,
} from "../_components/delete-company-dialog";
import {
  addCompanyNote,
  addCompanyTask,
  archiveCompany,
  assignCompany,
  deleteCompanyPermanently,
  getCompanyDeletionInfo,
  logCompanyCommunication,
  restoreCompany,
  updateCompanyStatus,
} from "../actions";
import { adminGetCompany } from "@/lib/backend";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-Mail",
  TELEFON: "Telefon",
  WHATSAPP: "WhatsApp",
  SONSTIGE: "Sonstige",
  MITTEILUNG: "Interne Mitteilung",
};

const KONTAKTANFRAGE_STATUS: Record<string, StatusDef> = {
  REQUESTED: { label: "Offen", tone: "warning" },
  APPROVED: { label: "Freigegeben", tone: "success" },
  DECLINED: { label: "Abgelehnt", tone: "danger" },
};
const VORSCHLAG_STATUS: Record<string, StatusDef> = {
  NEW: { label: "Neu", tone: "info" },
  SEEN: { label: "Gesehen", tone: "progress" },
  INTERESTED: { label: "Interessiert", tone: "success" },
  DECLINED: { label: "Abgelehnt", tone: "danger" },
};
const QUELLE_LABELS: Record<string, string> = {
  ADMIN: "Handauswahl",
  AUTOMATION: "Automatisch",
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

export default async function UnternehmenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await requireEmployee("companies");
  const { id } = await params;

  const companies = await sql`
    select c.*, cm.status as meta_status, cm.assignee_id, cm.archived_at,
           e.name as assignee_name, e.avatar_color as assignee_color
    from public."Company" c
    left join admin.company_meta cm on cm.company_id = c.id
    left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
    where c.id = ${id}
    limit 1`;
  const c = companies[0];
  if (!c) notFound();

  const [
    kpiRows,
    jobs,
    applications,
    offers,
    employees,
    auditRows,
    notes,
    tasks,
    communications,
    appointments,
    settingRows,
    tagRows,
    favoriteRows,
    betriebsakte,
  ] = await Promise.all([
    sql`
      select
        (select count(*)::int from public."JobPosting" j
         where j."companyId" = ${id} and j.status = 'ACTIVE') as active_jobs,
        (select count(*)::int from public."JobApplication" ja
         join public."JobPosting" j on j.id = ja."jobPostingId"
         where j."companyId" = ${id}) as applications,
        (select count(*)::int from public."JobOffer" o
         join public."JobPosting" j on j.id = o."jobPostingId"
         where j."companyId" = ${id}) as offers,
        (select count(*)::int from public."ContactRequest" cr
         where cr."companyId" = ${id} and cr.status = 'APPROVED') as contact_approvals`,
    sql`
      select j.id, j.title, j.status::text as status, j.city, j.gewerk,
             j."salaryMin", j."salaryMax", j."createdAt",
             (select count(*)::int from public."JobApplication" ja
              where ja."jobPostingId" = j.id) as application_count
      from public."JobPosting" j
      where j."companyId" = ${id}
      order by j."createdAt" desc`,
    sql`
      select ja.id, ja.status::text as status, ja."createdAt",
             j.title as job_title, j.id as job_id,
             u."firstName", u."lastName", u.email
      from public."JobApplication" ja
      join public."JobPosting" j on j.id = ja."jobPostingId"
      left join public."User" u on u.id = ja."userId"
      where j."companyId" = ${id}
      order by ja."createdAt" desc
      limit 100`,
    sql`
      select o.id, o.status::text as status, o."createdAt", o."contactPerson",
             j.title as job_title, j.id as job_id,
             u."firstName", u."lastName", u.email
      from public."JobOffer" o
      join public."JobPosting" j on j.id = o."jobPostingId"
      left join public."User" u on u.id = o."userId"
      where j."companyId" = ${id}
      order by o."createdAt" desc
      limit 100`,
    sql`select id, name from admin.employee
        where deleted_at is null and status = 'ACTIVE' order by name`,
    sql`select al.id, al.action, al.metadata, al.created_at, e.name as actor_name
        from admin.audit_log al
        left join admin.employee e on e.id = al.actor_id
        where al.entity_type = 'company' and al.entity_id = ${id}
        order by al.created_at desc limit 100`,
    sql`select n.id, n.content, n.category, n.pinned, n.created_at, e.name as author_name
        from admin.note n
        left join admin.employee e on e.id = n.author_id
        where n.entity_type = 'company' and n.entity_id = ${id} and n.deleted_at is null
        order by n.pinned desc, n.created_at desc`,
    sql`select t.id, t.title, t.description, t.status, t.priority, t.due_at, t.created_at,
               e.name as assignee_name, e.avatar_color as assignee_color
        from admin.task t
        left join admin.employee e on e.id = t.assignee_id
        where t.entity_type = 'company' and t.entity_id = ${id} and t.deleted_at is null
        order by t.created_at desc`,
    sql`select k.id, k.channel, k.direction, k.subject, k.body, k.occurred_at,
               e.name as employee_name
        from admin.communication k
        left join admin.employee e on e.id = k.employee_id
        where k.entity_type = 'company' and k.entity_id = ${id} and k.deleted_at is null
        order by k.occurred_at desc`,
    sql`select a.id, a.title, a.starts_at, a.location, e.name as employee_name
        from admin.appointment a
        left join admin.employee e on e.id = a.employee_id
        where a.entity_type = 'company' and a.entity_id = ${id} and a.deleted_at is null
        order by a.starts_at desc`,
    sql`select value from admin.setting where key = 'note_categories'`,
    sql`select t.id, t.name, t.color
        from admin.tag t
        join admin.entity_tag et on et.tag_id = t.id
        where et.entity_type = 'company' and et.entity_id = ${id}
        order by t.name asc`,
    sql`select 1 as found from admin.favorite
        where employee_id = ${employee.id}
          and entity_type = 'company' and entity_id = ${id}`,
    // Betriebsakte aus dem Backend (Konten/Anfragen/Vorschläge, anonymisiert —
    // nur kandidatId). Fail-open: bei Backend-Störung bleibt die Seite nutzbar.
    adminGetCompany(id).catch(() => null),
  ]);

  const kpi = kpiRows[0];
  const konten = betriebsakte?.konten ?? [];
  const anfragen = betriebsakte?.kontaktanfragen ?? [];
  const platformVorschlaege = betriebsakte?.vorschlaege ?? [];
  const zahlen = betriebsakte?.zahlen ?? {};
  const offeneAnfragen =
    zahlen.kontaktanfragenOffen ??
    anfragen.filter((a) => a.status === "REQUESTED").length;
  const offeneVorschlaege =
    zahlen.vorschlaegeOffen ??
    platformVorschlaege.filter((v) => v.status === "NEW" || v.status === "SEEN").length;
  const noteCategories = Array.isArray(settingRows[0]?.value)
    ? (settingRows[0].value as string[])
    : FALLBACK_NOTE_CATEGORIES;
  const metaStatus = (c.meta_status as string) ?? "NEU";

  // ── Timeline ────────────────────────────────────────────────────────────
  const AUDIT_TITLES: Record<string, string> = {
    "company.created": "Unternehmen angelegt",
    "company.status_changed": "Status geändert",
    "company.assigned": "Mitarbeiter zugewiesen",
    "company.archived": "Unternehmen archiviert",
    "company.restored": "Unternehmen wiederhergestellt",
  };
  const events: TimelineEvent[] = [
    {
      id: "erstellt",
      title: "Unternehmen erstellt",
      description: c.source ? `Quelle: ${c.source}` : null,
      timestamp: c.createdAt as Date,
      icon: Building2,
      tone: "success" as const,
    },
    ...auditRows
      .filter((a) => AUDIT_TITLES[a.action as string])
      .map((a) => {
        const meta = (a.metadata ?? {}) as Record<string, unknown>;
        return {
          id: `audit-${a.id}`,
          title: AUDIT_TITLES[a.action as string],
          description:
            a.action === "company.status_changed" && meta.status
              ? `Neuer Status: ${statusDef(COMPANY_STATUS, String(meta.status)).label}`
              : null,
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
          title: `${CHANNEL_LABELS[k.channel as string] ?? k.channel} (${k.direction === "INTERN" ? "intern" : k.direction === "INBOUND" ? "eingehend" : "ausgehend"})`,
          description:
            (k.subject as string) ?? (k.body as string)?.slice(0, 160) ?? null,
          actor: (k.employee_name as string) ?? null,
          timestamp: k.occurred_at as Date,
          icon: MessagesSquare,
        }) satisfies TimelineEvent,
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const canEdit = can(employee, "companies", "edit");
  const canAssign = can(employee, "companies", "assign");
  const canDelete = can(employee, "companies", "delete");
  const isArchived = c.archived_at != null;

  const tags: Tag[] = tagRows.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: (t.color as string | null) ?? null,
  }));
  const isFavorite = favoriteRows.length > 0;

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/unternehmen" className="hover:text-foreground">
          Unternehmen
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{c.name as string}</span>
      </nav>

      {isArchived && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed bg-muted/50 px-4 py-3">
          <Archive className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Dieses Unternehmen ist archiviert und taucht nicht mehr in der
            Standardliste auf.
          </p>
          {canDelete && (
            <RestoreCompanyButton companyId={id} action={restoreCompany} />
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {c.name as string}
            </h1>
            <FavoriteButton
              entityType="company"
              entityId={id}
              initialFavorited={isFavorite}
            />
            <StatusBadge map={COMPANY_STATUS} value={metaStatus} />
            {isArchived && <Badge variant="secondary">Archiviert</Badge>}
            {c.assignee_name ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <EmployeeAvatar
                  name={c.assignee_name as string}
                  color={c.assignee_color as string | null}
                  size="sm"
                />
                {c.assignee_name as string}
              </span>
            ) : null}
          </div>
          {c.slogan ? (
            <p className="mt-1 text-sm text-muted-foreground">{c.slogan as string}</p>
          ) : null}
          <div className="mt-3">
            <TagPicker
              entityType="company"
              entityId={id}
              initialTags={tags}
              canEdit={canEdit}
            />
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {[c.strasse, [c.plz, c.ort].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ") || "Keine Adresse hinterlegt"}
            </p>
            {c.website ? (
              <a
                href={
                  (c.website as string).startsWith("http")
                    ? (c.website as string)
                    : `https://${c.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Globe className="size-4 shrink-0" />
                {c.website as string}
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            {c.kontaktName ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <User className="size-4 shrink-0" />
                {c.kontaktName as string}
                {c.kontaktPosition ? ` · ${c.kontaktPosition}` : ""}
              </p>
            ) : null}
            {c.kontaktEmail ? (
              <a
                href={`mailto:${c.kontaktEmail}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <AtSign className="size-4 shrink-0" />
                {c.kontaktEmail as string}
              </a>
            ) : null}
            {c.kontaktTelefon ? (
              <a
                href={`tel:${c.kontaktTelefon}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Phone className="size-4 shrink-0" />
                {c.kontaktTelefon as string}
              </a>
            ) : null}
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              Erstellt am {formatDate(c.createdAt as Date)}
            </p>
          </div>
        </div>

        <aside className="h-fit space-y-4 rounded-lg border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Aktionen
          </p>
          {canEdit && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Status</p>
              <ActionSelect
                entityId={id}
                value={metaStatus}
                options={Object.entries(COMPANY_STATUS).map(([value, def]) => ({
                  value,
                  label: def.label,
                }))}
                action={updateCompanyStatus}
              />
            </div>
          )}
          {canAssign && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Zuständiger Mitarbeiter</p>
              <AssigneeSelect
                entityId={id}
                value={(c.assignee_id as string) ?? null}
                emptyLabel="Niemand zugewiesen"
                options={employees.map((e) => ({
                  value: e.id as string,
                  label: e.name as string,
                }))}
                action={assignCompany}
              />
            </div>
          )}
          {canEdit && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <NoteDialog
                entityId={id}
                categories={noteCategories}
                defaultCategory="UNTERNEHMEN"
                action={addCompanyNote}
              />
              <TaskDialog
                entityId={id}
                employees={employees.map((e) => ({
                  id: e.id as string,
                  name: e.name as string,
                }))}
                currentEmployeeId={employee.id}
                action={addCompanyTask}
              />
              <CommunicationDialog entityId={id} action={logCompanyCommunication} />
            </div>
          )}
          {!canEdit && !canAssign && (
            <p className="text-sm text-muted-foreground">
              Keine Bearbeitungsrechte für dieses Modul.
            </p>
          )}
          {canDelete && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Gefahrenzone
              </p>
              <DeleteCompanyDialog
                companyId={id}
                getInfo={getCompanyDeletionInfo}
                archiveAction={archiveCompany}
                deleteAction={deleteCompanyPermanently}
                redirectAfterDelete
              />
            </div>
          )}
        </aside>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label="Aktive Inserate"
          value={zahlen.inserateAktiv ?? (kpi?.active_jobs as number) ?? 0}
          accent
        />
        <KpiCard
          label="Bewerbungen"
          value={zahlen.bewerbungenGesamt ?? (kpi?.applications as number) ?? 0}
        />
        <KpiCard label="Angebote" value={(kpi?.offers as number) ?? 0} />
        <KpiCard label="Offene Anfragen" value={offeneAnfragen} />
        <KpiCard label="Offene Vorschläge" value={offeneVorschlaege} />
        <KpiCard
          label="Kontaktfreigaben"
          value={(kpi?.contact_approvals as number) ?? 0}
        />
      </div>

      <Tabs defaultValue="jobs" className="mt-6">
        <TabsList variant="line">
          <TabsTrigger value="jobs">
            Jobs{jobs.length > 0 ? ` (${jobs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="bewerbungen">
            Bewerbungen{applications.length > 0 ? ` (${applications.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="konten">
            Konten{konten.length > 0 ? ` (${konten.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="anfragen">
            Anfragen
            {offeneAnfragen > 0 ? ` (${offeneAnfragen} offen)` : anfragen.length > 0 ? ` (${anfragen.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="vorschlaege">
            Vorschläge{platformVorschlaege.length > 0 ? ` (${platformVorschlaege.length})` : ""}
          </TabsTrigger>
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

        {/* Jobs */}
        <TabsContent value="jobs" className="mt-4">
          {jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Keine Stellenanzeigen"
              description="Dieses Unternehmen hat noch keine Jobs veröffentlicht."
            />
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <details
                  key={j.id as string}
                  className="group rounded-lg border bg-card"
                >
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {j.title as string}
                    </span>
                    <StatusBadge map={JOB_STATUS} value={j.status as string} />
                    {j.city ? (
                      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                        <MapPin className="size-3" />
                        {j.city as string}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground tabular">
                      {formatSalary(j.salaryMin as number | null, j.salaryMax as number | null)}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
                      {j.application_count as number} Bewerbungen
                    </span>
                  </summary>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-3 text-sm text-muted-foreground">
                    {j.gewerk ? <span>Gewerk: {j.gewerk as string}</span> : null}
                    <span>Erstellt: {formatDate(j.createdAt as Date)}</span>
                    <Link
                      href={`/stellen/${j.id}`}
                      className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Zur Stellenanzeige
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bewerbungen */}
        <TabsContent value="bewerbungen" className="mt-4">
          {applications.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Keine Bewerbungen"
              description="Sobald sich Handwerker auf Jobs dieses Unternehmens bewerben, erscheinen sie hier."
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
                  <Link
                    href={`/stellen/${a.job_id}`}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    {a.job_title as string}
                  </Link>
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
          {offers.length > 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">
                Aktive Angebote des Unternehmens ({offers.length})
              </h3>
              <ul className="divide-y rounded-lg border bg-card">
                {offers.map((o) => (
                  <li
                    key={o.id as string}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {o.firstName || o.lastName
                        ? `${o.firstName ?? ""} ${o.lastName ?? ""}`.trim()
                        : ((o.email as string) ?? "Unbekannt")}
                    </span>
                    <Link
                      href={`/stellen/${o.job_id}`}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      {o.job_title as string}
                    </Link>
                    <span className="ml-auto flex items-center gap-3">
                      <StatusBadge map={JOB_OFFER_STATUS} value={o.status as string} />
                      <span className="text-xs text-muted-foreground tabular">
                        {formatDate(o.createdAt as Date)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        {/* Konten */}
        <TabsContent value="konten" className="mt-4">
          {konten.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Keine Login-Konten"
              description="Für diesen Betrieb sind keine Konten hinterlegt."
            />
          ) : (
            <>
              <ul className="divide-y rounded-lg border bg-card">
                {konten.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{k.name || k.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {k.email}
                        {k.telefon ? ` · ${k.telefon}` : ""}
                        {k.rolle ? ` · ${k.rolle}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {k.status === "DISABLED" ? (
                        <Badge variant="secondary" className="text-warning">
                          Gesperrt
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Aktiv</Badge>
                      )}
                      {k.emailBestaetigt ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <BadgeCheck className="size-3.5" /> E-Mail bestätigt
                        </span>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Die Registrierung erzwingt keine Bestätigung — relevant für die Vollständigkeit des DSGVO-Exports."
                        >
                          E-Mail unbestätigt
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular">
                        {k.zuletztAngemeldet
                          ? `zuletzt ${formatDate(new Date(k.zuletztAngemeldet))}`
                          : "nie angemeldet"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                „E-Mail unbestätigt" ist der Normalfall (keine Pflichtbestätigung) —
                kein Fehler; nur für die Vollständigkeit des DSGVO-Exports relevant.
              </p>
            </>
          )}
        </TabsContent>

        {/* Kontaktanfragen */}
        <TabsContent value="anfragen" className="mt-4">
          {anfragen.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Keine Kontaktanfragen"
              description="Fragt der Betrieb die Kontaktdaten eines Kandidaten an, erscheint das hier."
            />
          ) : (
            <ul className="space-y-2">
              {anfragen.map((a) => (
                <li
                  key={a.id}
                  className={
                    a.status === "REQUESTED"
                      ? "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3"
                      : "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-4 py-3"
                  }
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {a.position || "Kontaktanfrage"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Angefragt {a.angefragtAm ? formatDate(new Date(a.angefragtAm)) : "—"}
                      {a.entschiedenAm
                        ? ` · entschieden ${formatDate(new Date(a.entschiedenAm))}`
                        : ""}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <StatusBadge map={KONTAKTANFRAGE_STATUS} value={a.status} />
                    <Link
                      href={`/kandidaten/${a.kandidatId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Kandidat ansehen
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Vorschläge */}
        <TabsContent value="vorschlaege" className="mt-4">
          {platformVorschlaege.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Keine Vorschläge"
              description="Kandidatenvorschläge an diesen Betrieb erscheinen hier — anlegen über die Kandidatenliste."
            />
          ) : (
            <ul className="space-y-2">
              {platformVorschlaege.map((v) => (
                <li key={v.id} className="rounded-lg border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Link
                      href={`/kandidaten/${v.kandidatId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Kandidat ansehen
                    </Link>
                    {typeof v.score === "number" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular">
                        {v.score}%
                      </span>
                    ) : null}
                    <Badge variant="secondary">
                      {QUELLE_LABELS[v.quelle] ?? v.quelle}
                    </Badge>
                    <StatusBadge map={VORSCHLAG_STATUS} value={v.status} />
                    {v.jobPostingId ? (
                      <Link
                        href={`/stellen/${v.jobPostingId}`}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        zur Stelle
                      </Link>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground tabular">
                      {v.erstelltAm ? formatDate(new Date(v.erstelltAm)) : ""}
                    </span>
                  </div>
                  {v.begruendung ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {v.begruendung}
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
                defaultCategory="UNTERNEHMEN"
                action={addCompanyNote}
              />
            </div>
          )}
          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title="Noch keine Notizen"
              description="Halte Absprachen und Einschätzungen zu diesem Unternehmen fest."
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
                action={addCompanyTask}
              />
            </div>
          )}
          {tasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Keine Aufgaben"
              description="Lege Aufgaben an, um die Betreuung dieses Unternehmens zu organisieren."
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
              <CommunicationDialog entityId={id} action={logCompanyCommunication} />
            </div>
          )}
          {communications.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Keine Kommunikation protokolliert"
              description="Logge Telefonate und E-Mails mit diesem Unternehmen."
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
                        {k.direction === "INTERN" ? (
                          <>
                            <MessageCircle className="size-3.5" /> intern
                          </>
                        ) : k.direction === "INBOUND" ? (
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
