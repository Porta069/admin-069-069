import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, Handshake, Mail, Phone, ShieldAlert, ShieldCheck, UserSquare2 } from "lucide-react";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatDateTime, formatRelative, formatEuroCents } from "@/lib/format";
import { EMPLOYEE_STATUS } from "@/lib/definitions";
import type { PermissionMap } from "@/lib/permissions";
import {
  isFullAccess, countPermissions, levelLabel, mapToSelection,
} from "@/lib/rbac";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { Badge } from "@/components/ui/badge";
import { PermissionEditor } from "../_components/permission-editor";
import { EmployeeManage } from "../_components/employee-manage";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "employee.created": "Mitarbeiter erstellt",
  "employee.profile_updated": "Profil bearbeitet",
  "employee.role_changed": "Rolle geändert",
  "employee.permissions_changed": "Berechtigungen geändert",
  "employee.permissions_reset_to_template": "Rechte auf Template zurückgesetzt",
  "employee.activated": "Aktiviert",
  "employee.deactivated": "Deaktiviert",
  "employee.locked": "Gesperrt",
  "employee.password_reset": "Passwort zurückgesetzt",
  "employee.deleted": "Gelöscht",
};

export default async function MitarbeiterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireEmployee("employees");
  const { id } = await params;

  const [e] = await sql`
    select e.id, e.email, e.username, e.name, e.first_name, e.last_name, e.phone,
           e.status, e.team, e.avatar_color, e.avatar_url, e.role_id, e.permission_overrides,
           e.last_login_at, e.created_at, e.totp_enabled, e.must_change_password,
           e.created_by, r.name as role_name, r.permissions as role_permissions,
           r.level as role_level, r.icon as role_icon,
           (select name from admin.employee c where c.id = e.created_by) as created_by_name
    from admin.employee e join admin.role r on r.id = e.role_id
    where e.id = ${id} and e.deleted_at is null limit 1`;
  if (!e) notFound();

  const rolePerms = e.role_permissions as PermissionMap;
  const overrides = e.permission_overrides as PermissionMap | null;
  const hasCustom = Boolean(overrides && Object.keys(overrides).length > 0);
  const effektiv = hasCustom ? overrides! : rolePerms;

  const targetLevel = Number(e.role_level ?? 20);
  const master = isFullAccess(actor.permissions);
  const manage = (master || actor.roleLevel > targetLevel) && id !== actor.id;
  const canEdit = can(actor, "employees", "edit") && manage;
  // Löschen ist ausschließlich dem Master-Account vorbehalten.
  const canDelete = master && can(actor, "employees", "delete") && id !== actor.id;

  const roles = await sql`select id, name, level from admin.role order by level desc, name`;
  const assignable = roles
    .filter((r) => master || ((r.level as number) < actor.roleLevel && r.id !== "SUPERADMIN"))
    .map((r) => ({ id: r.id as string, name: r.name as string }));

  const [aktivitaet, logins, calls, assignedCands, assignedCompanies, assignedLeads, communications, placements] =
    await Promise.all([
      sql`
        select a.action, a.created_at, ac.name as actor_name
        from admin.audit_log a
        left join admin.employee ac on ac.id = a.actor_id
        where (a.entity_type = 'employee' and a.entity_id = ${id}) or a.actor_id = ${id}
        order by a.created_at desc limit 25`,
      sql`
        select success, ip, created_at from admin.login_event
        where employee_id = ${id} order by created_at desc limit 12`,
      sql`
        select cs.id, cs.application_id, cs.candidate_name, cs.status, cs.ergebnis,
               cs.notiz, cs.created_at, cs.completed_at
        from admin.call_session cs
        where cs.employee_id = ${id} and cs.deleted_at is null
        order by cs.created_at desc limit 30`,
      sql`
        select cm.application_id, cm.status, ca."firstName", ca."lastName"
        from admin.candidate_meta cm
        join admin.candidate ca on ca.id = cm.application_id
        where cm.assignee_id = ${id} and cm.archived_at is null
        order by cm.updated_at desc limit 60`,
      sql`
        select co.company_id, c.name as company_name
        from admin.company_meta co
        left join public."Company" c on c.id = co.company_id
        where co.assignee_id = ${id} and co.archived_at is null
        order by co.updated_at desc limit 60`,
      sql`
        select id, name, ort, status from admin.company_lead
        where assignee_id = ${id} and deleted_at is null
        order by updated_at desc limit 40`,
      sql`
        select ch.channel, ch.direction, ch.subject, ch.occurred_at,
               ch.entity_type, ch.entity_id
        from admin.communication ch
        where ch.employee_id = ${id} and ch.deleted_at is null
        order by ch.occurred_at desc limit 25`,
      sql`
        select pl.id, pl.candidate_name, pl.company_name, pl.job_title, pl.status,
               pl.placed_at, pl.base_fee_cents, pl.commission_cents
        from admin.placement pl
        where pl.employee_id = ${id} and pl.deleted_at is null
          and pl.status <> 'CANCELLED'
        order by pl.placed_at desc limit 30`,
    ]);

  const name = e.name as string;
  const placementRevenue = placements.reduce(
    (s, p) => s + Number(p.base_fee_cents ?? 0) + Number(p.commission_cents ?? 0),
    0,
  );

  return (
    <div>
      <Link href="/mitarbeiter" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Mitarbeiter
      </Link>
      <PageHeader
        title={name}
        description={`@${e.username as string}${e.email ? ` · ${e.email as string}` : ""}`}
        actions={
          <span className="flex items-center gap-2">
            <StatusBadge map={EMPLOYEE_STATUS} value={e.status as string} />
            <Badge variant="secondary">{e.role_name as string}</Badge>
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Profil */}
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <EmployeeAvatar
                name={name}
                color={e.avatar_color as string}
                imageUrl={e.avatar_url as string | null}
                size="lg"
              />
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{levelLabel(targetLevel)} · {e.role_name as string}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Fact label="Username" value={`@${e.username as string}`} />
              <Fact label="E-Mail" value={(e.email as string) || "—"} />
              <Fact label="Telefon" value={(e.phone as string) || "—"} />
              <Fact label="Team" value={(e.team as string) || "—"} />
              <Fact label="Template / Rolle" value={e.role_name as string} />
              <Fact label="Berechtigungen" value={`${countPermissions(effektiv)}${hasCustom ? " (individuell)" : ""}`} />
              <Fact label="Erstellt von" value={(e.created_by_name as string) || "System"} />
              <Fact label="Erstellt am" value={formatDate(e.created_at as Date)} />
              <Fact label="Letzter Login" value={e.last_login_at ? formatRelative(e.last_login_at as Date) : "Noch nie"} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${e.totp_enabled ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                {e.totp_enabled ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                2FA {e.totp_enabled ? "aktiv" : "noch nicht eingerichtet"}
              </span>
              {e.must_change_password && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  Passwortänderung ausstehend
                </span>
              )}
            </div>
          </section>

          {/* Berechtigungen */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-1 font-display text-sm font-semibold">Berechtigungen</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {hasCustom ? "Individuell angepasst." : `Folgt dem Template „${e.role_name as string}".`} Durchsetzung erfolgt ausschließlich serverseitig.
            </p>
            {isFullAccess(effektiv) ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed bg-accent/60 p-4">
                <ShieldCheck className="size-5 text-primary" />
                <p className="text-sm">Vollzugriff (Master) — uneingeschränkte Rechte auf alle Module.</p>
              </div>
            ) : (
              <PermissionEditor
                employeeId={id}
                canEdit={canEdit}
                templateName={e.role_name as string}
                templateSelection={mapToSelection(rolePerms)}
                initialMode={hasCustom ? "custom" : "template"}
                initialSelection={mapToSelection(effektiv)}
                actorPermissions={actor.permissions}
              />
            )}
          </section>

          {/* Aktivitäten + Logins */}
          <div className="grid gap-5 sm:grid-cols-2">
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 font-display text-sm font-semibold">Aktivitäten</h2>
              {aktivitaet.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>
              ) : (
                <ul className="space-y-2.5">
                  {aktivitaet.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p>{ACTION_LABEL[a.action as string] ?? (a.action as string)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(a.created_at as Date)}{a.actor_name ? ` · ${a.actor_name as string}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 font-display text-sm font-semibold">Login-Historie</h2>
              {logins.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Anmeldungen.</p>
              ) : (
                <ul className="space-y-2">
                  {logins.map((l, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className={l.success ? "text-success" : "text-destructive"}>
                        {l.success ? "Erfolgreich" : "Fehlgeschlagen"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(l.created_at as Date)}{l.ip ? ` · ${l.ip as string}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Vermittlungen dieses Mitarbeiters */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Handshake className="size-4 text-muted-foreground" /> Vermittlungen
              <span className="ml-auto flex items-center gap-3 text-xs font-normal text-muted-foreground">
                <span>{placements.length}</span>
                {placementRevenue > 0 && (
                  <span className="font-medium text-success tabular">
                    {formatEuroCents(placementRevenue)}
                  </span>
                )}
              </span>
            </h2>
            {placements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Vermittlungen.</p>
            ) : (
              <ul className="divide-y">
                {placements.map((pl) => (
                  <li key={pl.id as string} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/vermittlungen`} className="font-medium hover:underline">
                        {(pl.candidate_name as string) ?? "Kandidat"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {[pl.company_name, pl.job_title].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">{formatDate(pl.placed_at as Date)}</p>
                      <p className="text-xs tabular">
                        {formatEuroCents(Number(pl.base_fee_cents ?? 0) + Number(pl.commission_cents ?? 0))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Telefonate dieses Mitarbeiters */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Phone className="size-4 text-muted-foreground" /> Telefonate
            </h2>
            {calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Anrufe protokolliert.</p>
            ) : (
              <ul className="divide-y">
                {calls.map((cs) => (
                  <li key={cs.id as string} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/kandidaten/${cs.application_id as string}`} className="font-medium hover:underline">
                        {(cs.candidate_name as string) ?? "Kandidat"}
                      </Link>
                      {cs.notiz ? (
                        <p className="truncate text-xs text-muted-foreground" title={cs.notiz as string}>
                          {cs.notiz as string}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">{formatDateTime(cs.created_at as Date)}</p>
                      <p className="text-xs">
                        <span className="text-muted-foreground">{callDuration(cs.created_at as Date, cs.completed_at as Date | null)}</span>
                        {cs.ergebnis ? <span className="ml-1">· {cs.ergebnis as string}</span> : cs.status ? <span className="ml-1">· {cs.status as string}</span> : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Zuordnungen */}
          <div className="grid gap-5 sm:grid-cols-2">
            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                <UserSquare2 className="size-4 text-muted-foreground" /> Zugeordnete Kandidaten
                <span className="ml-auto text-xs text-muted-foreground">{assignedCands.length}</span>
              </h2>
              {assignedCands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Zuordnungen.</p>
              ) : (
                <ul className="space-y-1.5">
                  {assignedCands.map((ca) => (
                    <li key={ca.application_id as string} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/kandidaten/${ca.application_id as string}`} className="truncate hover:underline">
                        {`${ca.firstName ?? ""} ${ca.lastName ?? ""}`.trim() || "Kandidat"}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{(ca.status as string) ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
                <Building2 className="size-4 text-muted-foreground" /> Zugeordnete Unternehmen
                <span className="ml-auto text-xs text-muted-foreground">{assignedCompanies.length + assignedLeads.length}</span>
              </h2>
              {assignedCompanies.length === 0 && assignedLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Zuordnungen.</p>
              ) : (
                <ul className="space-y-1.5">
                  {assignedCompanies.map((co) => (
                    <li key={co.company_id as string} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/unternehmen/${co.company_id as string}`} className="truncate hover:underline">
                        {(co.company_name as string) ?? "Unternehmen"}
                      </Link>
                    </li>
                  ))}
                  {assignedLeads.map((l) => (
                    <li key={l.id as string} className="flex items-center justify-between gap-2 text-sm">
                      <Link href="/anwerbung" className="truncate hover:underline">{l.name as string}</Link>
                      <span className="shrink-0 text-xs text-muted-foreground">Lead{l.ort ? ` · ${l.ort as string}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Kommunikation */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Mail className="size-4 text-muted-foreground" /> Kommunikation
            </h2>
            {communications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Kommunikation.</p>
            ) : (
              <ul className="divide-y">
                {communications.map((ch, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{(ch.subject as string) || (ch.channel as string)}</p>
                      <p className="text-xs text-muted-foreground">
                        {(ch.channel as string)} · {(ch.direction as string) === "OUT" ? "ausgehend" : "eingehend"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(ch.occurred_at as Date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Verwaltung */}
        <div className="space-y-5">
          {(canEdit || canDelete) ? (
            <EmployeeManage
              employeeId={id}
              name={name}
              status={e.status as string}
              roleId={e.role_id as string}
              roles={assignable}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ) : (
            <div className="rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
              {id === actor.id
                ? "Der eigene Account kann hier nicht verwaltet werden."
                : "Du hast keine Berechtigung, dieses Konto zu verwalten."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Anrufdauer aus Start-/Endzeit — „—" wenn nicht abgeschlossen. */
function callDuration(created: Date, completed: Date | null): string {
  if (!completed) return "offen";
  const sec = Math.max(0, Math.round((new Date(completed).getTime() - new Date(created).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium" title={value}>{value}</dd>
    </div>
  );
}
