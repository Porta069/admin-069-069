import Link from "next/link";
import { Plus, Download, ShieldCheck, ShieldOff, LayoutGrid } from "lucide-react";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  firstParam,
  readTableParams,
  safeSort,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatNumber, formatRelative, formatEuroCents } from "@/lib/format";
import { PresenceDot } from "@/components/common/presence-badge";
import { EMPLOYEE_STATUS } from "@/lib/definitions";
import { countPermissions } from "@/lib/rbac";
import type { PermissionMap } from "@/lib/permissions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeRowActions } from "./_components/employee-row-actions";

const COLUMNS: DataTableColumn[] = [
  { key: "mitarbeiter", label: "Mitarbeiter", sortable: true },
  { key: "rolle", label: "Rolle / Template" },
  { key: "team", label: "Team", defaultHidden: true },
  { key: "status", label: "Status" },
  { key: "zweifa", label: "2FA", className: "text-center" },
  { key: "kandidaten", label: "Kandidaten", sortable: true, className: "text-right" },
  { key: "unternehmen", label: "Unternehmen", sortable: true, className: "text-right" },
  { key: "telefonate", label: "Telefonate", sortable: true, className: "text-right" },
  { key: "vermittlungen", label: "Vermittlungen", sortable: true, className: "text-right" },
  { key: "umsatz", label: "Umsatz", sortable: true, className: "text-right", defaultHidden: true },
  { key: "aufgaben", label: "Offene Aufgaben", sortable: true, className: "text-right" },
  { key: "rechte", label: "Rechte", className: "text-right", defaultHidden: true },
  { key: "lastLogin", label: "Letzter Login", sortable: true },
  { key: "createdBy", label: "Erstellt von", defaultHidden: true },
  { key: "createdAt", label: "Erstellt", sortable: true, defaultHidden: true },
  { key: "aktionen", label: "", className: "w-12 text-right" },
];

export default async function MitarbeiterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("employees");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "mitarbeiter",
    dir: "asc",
  });
  const roleFilter = firstParam(params.rolle);
  const statusFilter = firstParam(params.status);
  const teamFilter = firstParam(params.team);

  const orderBy = safeSort(
    sort,
    {
      mitarbeiter: "e.name",
      lastLogin: "e.last_login_at",
      createdAt: "e.created_at",
      kandidaten: "cand_count",
      unternehmen: "comp_count",
      telefonate: "call_count",
      aufgaben: "open_tasks",
      vermittlungen: "placement_count",
      umsatz: "placement_revenue",
    },
    "e.name",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, countRows, roles, teamRows, statsRows] = await Promise.all([
    sql`
      select e.id, e.email, e.username, e.name, e.status, e.team, e.avatar_color, e.avatar_url,
             e.presence, e.last_seen_at,
             e.role_id, e.last_login_at, e.created_at, e.permission_overrides, e.totp_enabled,
             r.name as role_name, r.permissions as role_permissions,
             (select c.name from admin.employee c where c.id = e.created_by) as created_by_name,
             (select count(*)::int from admin.candidate_meta cm
                where cm.assignee_id = e.id and cm.archived_at is null) as cand_count,
             (select count(*)::int from admin.company_meta co
                where co.assignee_id = e.id and co.archived_at is null) as comp_count,
             (select count(*)::int from admin.call_session cs
                where cs.employee_id = e.id and cs.deleted_at is null) as call_count,
             (select count(*)::int from admin.call_session cs
                where cs.employee_id = e.id and cs.deleted_at is null
                  and cs.created_at >= now() - interval '7 days') as call_week,
             (select count(*)::int from admin.task t
                where t.assignee_id = e.id and t.status = 'OPEN' and t.deleted_at is null) as open_tasks,
             (select count(*)::int from admin.placement pl
                where pl.employee_id = e.id and pl.deleted_at is null
                  and pl.status <> 'CANCELLED') as placement_count,
             (select coalesce(sum(pl.base_fee_cents + coalesce(pl.commission_cents, 0)), 0)::bigint
                from admin.placement pl
                where pl.employee_id = e.id and pl.deleted_at is null
                  and pl.status <> 'CANCELLED') as placement_revenue
      from admin.employee e
      join admin.role r on r.id = e.role_id
      where e.deleted_at is null
        ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like} or e.username ilike ${like})` : sql``}
        ${roleFilter ? sql`and e.role_id = ${roleFilter}` : sql``}
        ${statusFilter ? sql`and e.status = ${statusFilter}` : sql``}
        ${teamFilter ? sql`and e.team = ${teamFilter}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.employee e
      where e.deleted_at is null
        ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like} or e.username ilike ${like})` : sql``}
        ${roleFilter ? sql`and e.role_id = ${roleFilter}` : sql``}
        ${statusFilter ? sql`and e.status = ${statusFilter}` : sql``}
        ${teamFilter ? sql`and e.team = ${teamFilter}` : sql``}`,
    sql`
      select id, name from admin.role
      order by array_position(array['SUPERADMIN','ADMIN','TEAMLEAD','STAFF'], id) nulls last, name`,
    sql`
      select distinct team from admin.employee
      where team is not null and team <> '' and deleted_at is null
      order by team`,
    sql`
      select
        (select count(*)::int from admin.employee where deleted_at is null) as total,
        (select count(*)::int from admin.employee where deleted_at is null and status = 'ACTIVE') as active,
        (select count(*)::int from admin.employee where deleted_at is null and totp_enabled = true) as twofa,
        (select count(*)::int from admin.call_session
           where deleted_at is null and created_at >= now() - interval '7 days') as calls_week,
        (select count(*)::int from admin.placement
           where deleted_at is null and status <> 'CANCELLED'
             and placed_at >= date_trunc('month', now())) as placements_month`,
  ]);
  const total = countRows[0].count as number;
  const stats = statsRows[0] as {
    total: number; active: number; twofa: number; calls_week: number;
    placements_month: number;
  };
  const teamOptions = teamRows.map((t) => t.team as string);

  const roleOptions = roles.map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));
  const canCreate = can(employee, "employees", "create");
  const canEdit = can(employee, "employees", "edit");
  const canDelete = can(employee, "employees", "delete");
  const actorIsSuperadmin = employee.roleId === "SUPERADMIN";

  const tableRows: DataTableRow[] = rows.map((r) => {
    const overrides = r.permission_overrides as PermissionMap | null;
    const hasCustom = Boolean(overrides && Object.keys(overrides).length > 0);
    const effektiv = hasCustom ? overrides! : (r.role_permissions as PermissionMap);
    return {
    id: r.id as string,
    href: `/mitarbeiter/${r.id}`,
    cells: {
      mitarbeiter: (
        <span className="flex items-center gap-2.5">
          <span className="relative inline-flex">
            <EmployeeAvatar
              name={r.name as string}
              color={r.avatar_color as string}
              imageUrl={r.avatar_url as string | null}
            />
            <PresenceDot presence={r.presence as string} lastSeenAt={r.last_seen_at as Date | null} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.name as string}</span>
            <span className="block truncate text-xs text-muted-foreground">
              @{r.username as string}
            </span>
          </span>
        </span>
      ),
      rolle: (
        <Badge variant={r.role_id === "SUPERADMIN" ? "default" : "secondary"}>
          {r.role_name as string}
        </Badge>
      ),
      team: (r.team as string | null) ?? (
        <span className="text-muted-foreground">—</span>
      ),
      status: <StatusBadge map={EMPLOYEE_STATUS} value={r.status as string} />,
      zweifa: (
        <span className="flex justify-center">
          {r.totp_enabled ? (
            <ShieldCheck className="size-4 text-success" aria-label="2FA aktiv" />
          ) : (
            <ShieldOff className="size-4 text-muted-foreground/50" aria-label="Keine 2FA" />
          )}
        </span>
      ),
      kandidaten: (
        <span className="block text-right tabular">{formatNumber(r.cand_count as number)}</span>
      ),
      unternehmen: (
        <span className="block text-right tabular">{formatNumber(r.comp_count as number)}</span>
      ),
      telefonate: (
        <span className="block text-right tabular" title={`${r.call_week} in den letzten 7 Tagen`}>
          {formatNumber(r.call_count as number)}
          {(r.call_week as number) > 0 && (
            <span className="ml-1 text-xs text-success">+{r.call_week as number}</span>
          )}
        </span>
      ),
      vermittlungen: (
        <span
          className={
            (r.placement_count as number) > 0
              ? "block text-right tabular font-medium text-success"
              : "block text-right tabular text-muted-foreground"
          }
          title={`${formatEuroCents(Number(r.placement_revenue ?? 0))} Umsatz`}
        >
          {formatNumber(r.placement_count as number)}
        </span>
      ),
      umsatz: (
        <span className="block text-right tabular text-muted-foreground">
          {formatEuroCents(Number(r.placement_revenue ?? 0))}
        </span>
      ),
      aufgaben: (
        <span
          className={
            (r.open_tasks as number) > 0
              ? "block text-right tabular font-medium"
              : "block text-right tabular text-muted-foreground"
          }
        >
          {formatNumber(r.open_tasks as number)}
        </span>
      ),
      rechte: (
        <span className="block text-right tabular" title={hasCustom ? "Individuell angepasst" : "Folgt Template"}>
          {formatNumber(countPermissions(effektiv))}
          {hasCustom && <span className="ml-1 text-xs text-warning">•</span>}
        </span>
      ),
      lastLogin: (
        <span className="text-muted-foreground">
          {r.last_login_at ? formatRelative(r.last_login_at as Date) : "Noch nie"}
        </span>
      ),
      createdBy: (
        <span className="text-muted-foreground">{(r.created_by_name as string) ?? "System"}</span>
      ),
      createdAt: (
        <span className="text-muted-foreground tabular">
          {formatDate(r.created_at as Date)}
        </span>
      ),
      aktionen: (
        <span className="flex justify-end">
          <EmployeeRowActions
            employee={{
              id: r.id as string,
              name: r.name as string,
              roleId: r.role_id as string,
              status: r.status as string,
            }}
            roles={roleOptions}
            actorIsSuperadmin={actorIsSuperadmin}
            canEdit={canEdit}
            canDelete={canDelete}
            isSelf={r.id === employee.id}
          />
        </span>
      ),
    },
    };
  });

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", q);
  if (roleFilter) exportQuery.set("rolle", roleFilter);
  if (statusFilter) exportQuery.set("status", statusFilter);
  if (teamFilter) exportQuery.set("team", teamFilter);
  const exportHref = `/mitarbeiter/export${exportQuery.toString() ? `?${exportQuery}` : ""}`;

  const twofaQuote = stats.total > 0 ? Math.round((stats.twofa / stats.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Mitarbeiter"
        description="Zugänge, Rollen und Arbeitslast des internen Teams verwalten."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/mitarbeiter/verteilung">
                <LayoutGrid className="size-4" /> Zuständigkeitsverteilung
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={exportHref}>
                <Download className="size-4" /> Export
              </a>
            </Button>
            {canCreate && (
              <Button asChild size="sm">
                <Link href="/mitarbeiter/neu">
                  <Plus className="size-4" /> Mitarbeiter hinzufügen
                </Link>
              </Button>
            )}
          </div>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard accent label="Mitarbeiter" value={formatNumber(stats.total)} hint={`${stats.active} aktiv`} />
        <KpiCard label="Aktiv" value={formatNumber(stats.active)} />
        <KpiCard
          label="2FA aktiv"
          value={`${twofaQuote} %`}
          hint={`${formatNumber(stats.twofa)} von ${formatNumber(stats.total)}`}
        />
        <KpiCard label="Telefonate (7 Tage)" value={formatNumber(stats.calls_week)} />
        <KpiCard label="Vermittlungen (Monat)" value={formatNumber(stats.placements_month)} />
      </div>
      <DataTable
        tableId="mitarbeiter"
        columns={COLUMNS}
        rows={tableRows}
        total={total}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Name oder E-Mail suchen…"
        emptyTitle="Keine Mitarbeiter gefunden"
        emptyDescription="Lege den ersten Mitarbeiter an oder passe die Filter an."
        toolbar={
          <>
            <FilterSelect
              param="rolle"
              placeholder="Alle Rollen"
              options={roleOptions.map((r) => ({ value: r.id, label: r.name }))}
            />
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={Object.entries(EMPLOYEE_STATUS).map(([value, def]) => ({
                value,
                label: def.label,
              }))}
            />
            {teamOptions.length > 0 && (
              <FilterSelect
                param="team"
                placeholder="Alle Teams"
                options={teamOptions.map((t) => ({ value: t, label: t }))}
              />
            )}
          </>
        }
      />
    </>
  );
}
