import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  JOB_APPLICATION_STATUS,
  JOB_STATUS,
  TASK_STATUS,
} from "@/lib/definitions";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Timeline, type TimelineEvent } from "@/components/common/timeline";
import { Badge } from "@/components/ui/badge";
import {
  AtSign,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  MapPin,
  Phone,
  Pin,
  StickyNote,
  User,
  UserSquare2,
} from "lucide-react";
import { NoteDialog, TaskDialog } from "../_components/entity-actions";
import { addApplicationNote, addApplicationTask } from "../actions";

const FALLBACK_NOTE_CATEGORIES = [
  "ALLGEMEIN",
  "BEWERBUNG",
  "INTERVIEW",
  "UNTERNEHMEN",
  "KOMMUNIKATION",
  "WICHTIG",
  "INTERN",
];

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

export default async function BewerbungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const employee = await requireEmployee("applications");
  const { id } = await params;

  const rows = await sql`
    select ja.id, ja.status::text as status, ja."createdAt", ja."updatedAt",
           u.id as user_id, u."firstName", u."lastName", u.email, u.phone,
           j.id as job_id, j.title as job_title, j.city as job_city,
           j.gewerk as job_gewerk, j.status::text as job_status,
           c.id as company_id, c.name as company_name, c.ort as company_ort,
           c."kontaktName" as company_kontakt
    from public."JobApplication" ja
    left join public."User" u on u.id = ja."userId"
    join public."JobPosting" j on j.id = ja."jobPostingId"
    left join public."Company" c on c.id = j."companyId"
    where ja.id = ${id}
    limit 1`;
  const b = rows[0];
  if (!b) notFound();

  const [candidates, auditRows, notes, tasks, employees, settingRows] =
    await Promise.all([
      b.email
        ? sql`select id, "firstName", "lastName" from public."Application"
              where lower(email) = lower(${b.email as string}) and status <> 'ERASED'
              limit 1`
        : Promise.resolve([]),
      sql`select al.id, al.action, al.metadata, al.created_at, e.name as actor_name
          from admin.audit_log al
          left join admin.employee e on e.id = al.actor_id
          where al.entity_type = 'application' and al.entity_id = ${id}
          order by al.created_at desc limit 100`,
      sql`select n.id, n.content, n.category, n.pinned, n.created_at, e.name as author_name
          from admin.note n
          left join admin.employee e on e.id = n.author_id
          where n.entity_type = 'application' and n.entity_id = ${id} and n.deleted_at is null
          order by n.pinned desc, n.created_at desc`,
      sql`select t.id, t.title, t.description, t.status, t.priority, t.due_at, t.created_at,
                 e.name as assignee_name, e.avatar_color as assignee_color
          from admin.task t
          left join admin.employee e on e.id = t.assignee_id
          where t.entity_type = 'application' and t.entity_id = ${id} and t.deleted_at is null
          order by t.created_at desc`,
      sql`select id, name from admin.employee
          where deleted_at is null and status = 'ACTIVE' order by name`,
      sql`select value from admin.setting where key = 'note_categories'`,
    ]);

  const candidate = candidates[0];
  const noteCategories = Array.isArray(settingRows[0]?.value)
    ? (settingRows[0].value as string[])
    : FALLBACK_NOTE_CATEGORIES;

  const bewerberName =
    b.firstName || b.lastName
      ? `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim()
      : ((b.email as string) ?? "Unbekannter Bewerber");

  // ── Status-Verlauf ──────────────────────────────────────────────────────
  const events: TimelineEvent[] = [
    {
      id: "eingang",
      title: "Bewerbung eingegangen",
      description: `Auf „${b.job_title}"`,
      timestamp: b.createdAt as Date,
      icon: FileText,
      tone: "success" as const,
    },
    ...auditRows
      .filter(
        (a) =>
          !String(a.action).endsWith("note_added") &&
          !String(a.action).endsWith("task_created"),
      )
      .map(
        (a) =>
          ({
            id: `audit-${a.id}`,
            title: String(a.action),
            actor: (a.actor_name as string) ?? null,
            timestamp: a.created_at as Date,
            icon: History,
          }) satisfies TimelineEvent,
      ),
  ].sort(
    (a, b2) =>
      new Date(b2.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const canEdit = can(employee, "applications", "edit");

  return (
    <>
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/bewerbungen" className="hover:text-foreground">
          Bewerbungen
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="line-clamp-1 font-medium text-foreground">
          {bewerberName} → {b.job_title as string}
        </span>
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Bewerbung von {bewerberName}
        </h1>
        <StatusBadge map={JOB_APPLICATION_STATUS} value={b.status as string} />
        <span className="ml-auto text-sm text-muted-foreground tabular">
          Beworben am {formatDate(b.createdAt as Date)} · Letzte Aktivität{" "}
          {formatRelative(b.updatedAt as Date)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bewerber */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <User className="size-4 text-muted-foreground" />
            Bewerber
          </h2>
          <dl className="mt-4 space-y-3">
            <Fact label="Name" value={bewerberName} />
            <Fact
              label="E-Mail"
              value={
                b.email ? (
                  <a
                    href={`mailto:${b.email}`}
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    <AtSign className="size-3.5 text-muted-foreground" />
                    {b.email as string}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <Fact
              label="Telefon"
              value={
                b.phone ? (
                  <a
                    href={`tel:${b.phone}`}
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {b.phone as string}
                  </a>
                ) : (
                  "—"
                )
              }
            />
          </dl>
          {candidate ? (
            <Link
              href={`/kandidaten/${candidate.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <UserSquare2 className="size-4" />
              Zum Kandidatenprofil
            </Link>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Kein Kandidatenprofil mit dieser E-Mail-Adresse gefunden.
            </p>
          )}
        </section>

        {/* Stelle */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="size-4 text-muted-foreground" />
            Stelle
          </h2>
          <dl className="mt-4 space-y-3">
            <Fact
              label="Titel"
              value={
                <Link
                  href={`/stellen/${b.job_id}`}
                  className="hover:text-primary hover:underline"
                >
                  {b.job_title as string}
                </Link>
              }
            />
            <Fact label="Gewerk" value={b.job_gewerk as string} />
            <Fact
              label="Stadt"
              value={
                b.job_city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {b.job_city as string}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Job-Status
              </dt>
              <dd className="mt-1">
                <StatusBadge map={JOB_STATUS} value={b.job_status as string} />
              </dd>
            </div>
          </dl>
        </section>

        {/* Unternehmen */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-muted-foreground" />
            Unternehmen
          </h2>
          {b.company_id ? (
            <dl className="mt-4 space-y-3">
              <Fact
                label="Name"
                value={
                  <Link
                    href={`/unternehmen/${b.company_id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {b.company_name as string}
                  </Link>
                }
              />
              <Fact label="Ort" value={b.company_ort as string} />
              <Fact label="Ansprechpartner" value={b.company_kontakt as string} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Kein Unternehmen verknüpft.
            </p>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Status-Verlauf */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" />
            Status-Verlauf
          </h2>
          <div className="mt-4">
            <Timeline events={events} />
          </div>
        </section>

        {/* Notizen + Aufgaben */}
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="size-4 text-muted-foreground" />
                Interne Notizen
              </h2>
              {canEdit && (
                <NoteDialog
                  entityId={id}
                  categories={noteCategories}
                  defaultCategory="BEWERBUNG"
                  triggerLabel="Status-Notiz"
                  action={addApplicationNote}
                />
              )}
            </div>
            {notes.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Noch keine Notizen zu dieser Bewerbung.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {notes.map((n) => (
                  <li key={n.id as string} className="rounded-md border bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {((n.category as string) ?? "BEWERBUNG").charAt(0) +
                          ((n.category as string) ?? "BEWERBUNG")
                            .slice(1)
                            .toLowerCase()}
                      </Badge>
                      {Boolean(n.pinned) && <Pin className="size-3.5 text-primary" />}
                      <span className="ml-auto text-xs text-muted-foreground tabular">
                        {formatDateTime(n.created_at as Date)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">
                      {n.content as string}
                    </p>
                    {n.author_name ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {n.author_name as string}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4 text-muted-foreground" />
                Aufgaben
              </h2>
              {canEdit && (
                <TaskDialog
                  entityId={id}
                  employees={employees.map((e) => ({
                    id: e.id as string,
                    name: e.name as string,
                  }))}
                  currentEmployeeId={employee.id}
                  action={addApplicationTask}
                />
              )}
            </div>
            {tasks.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Keine Aufgaben zu dieser Bewerbung.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id as string}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title as string}</p>
                      {t.due_at ? (
                        <p className="mt-0.5 text-xs text-muted-foreground tabular">
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
          </section>
        </div>
      </div>
    </>
  );
}
