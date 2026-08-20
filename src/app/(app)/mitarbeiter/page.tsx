import Link from "next/link";
import { Plus } from "lucide-react";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  firstParam,
  readTableParams,
  safeSort,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { EMPLOYEE_STATUS } from "@/lib/definitions";
import { countPermissions } from "@/lib/rbac";
import type { PermissionMap } from "@/lib/permissions";
import { PageHeader } from "@/components/common/page-header";
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
  { key: "rechte", label: "Rechte", className: "text-right" },
  { key: "lastLogin", label: "Letzter Login", sortable: true },
  { key: "createdBy", label: "Erstellt von", defaultHidden: true },
  { key: "createdAt", label: "Erstellt", sortable: true },
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

  const orderBy = safeSort(
    sort,
    {
      mitarbeiter: "e.name",
      lastLogin: "e.last_login_at",
      createdAt: "e.created_at",
    },
    "e.name",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, countRows, roles] = await Promise.all([
    sql`
      select e.id, e.email, e.username, e.name, e.status, e.team, e.avatar_color,
             e.role_id, e.last_login_at, e.created_at, e.permission_overrides,
             r.name as role_name, r.permissions as role_permissions,
             (select c.name from admin.employee c where c.id = e.created_by) as created_by_name
      from admin.employee e
      join admin.role r on r.id = e.role_id
      where e.deleted_at is null
        ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like})` : sql``}
        ${roleFilter ? sql`and e.role_id = ${roleFilter}` : sql``}
        ${statusFilter ? sql`and e.status = ${statusFilter}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.employee e
      where e.deleted_at is null
        ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like})` : sql``}
        ${roleFilter ? sql`and e.role_id = ${roleFilter}` : sql``}
        ${statusFilter ? sql`and e.status = ${statusFilter}` : sql``}`,
    sql`
      select id, name from admin.role
      order by array_position(array['SUPERADMIN','ADMIN','TEAMLEAD','STAFF'], id) nulls last, name`,
  ]);
  const total = countRows[0].count as number;

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
          <EmployeeAvatar name={r.name as string} color={r.avatar_color as string} />
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

  return (
    <>
      <PageHeader
        title="Mitarbeiter"
        description="Zugänge, Rollen und Arbeitslast des internen Teams verwalten."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/mitarbeiter/neu">
                <Plus className="size-4" /> Mitarbeiter hinzufügen
              </Link>
            </Button>
          ) : undefined
        }
      />
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
          </>
        }
      />
    </>
  );
}
