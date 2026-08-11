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
import { PageHeader } from "@/components/common/page-header";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { CreateEmployeeDialog } from "./_components/create-employee-dialog";
import { EmployeeRowActions } from "./_components/employee-row-actions";

const COLUMNS: DataTableColumn[] = [
  { key: "mitarbeiter", label: "Mitarbeiter", sortable: true },
  { key: "rolle", label: "Rolle" },
  { key: "team", label: "Team" },
  { key: "status", label: "Status" },
  { key: "lastLogin", label: "Letzter Login", sortable: true },
  { key: "kandidaten", label: "Zugewiesene Kandidaten", className: "text-right" },
  { key: "aufgaben", label: "Offene Aufgaben", className: "text-right" },
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
      select e.id, e.email, e.name, e.status, e.team, e.avatar_color,
             e.role_id, e.last_login_at, e.created_at, r.name as role_name,
             (select count(*)::int from admin.candidate_meta cm
                where cm.assignee_id = e.id and cm.archived_at is null) as candidate_count,
             (select count(*)::int from admin.task t
                where t.assignee_id = e.id and t.deleted_at is null
                  and t.status in ('OPEN','IN_PROGRESS')) as open_task_count
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

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    cells: {
      mitarbeiter: (
        <span className="flex items-center gap-2.5">
          <EmployeeAvatar name={r.name as string} color={r.avatar_color as string} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.name as string}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {r.email as string}
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
      lastLogin: (
        <span className="text-muted-foreground">
          {r.last_login_at ? formatRelative(r.last_login_at as Date) : "Noch nie"}
        </span>
      ),
      kandidaten: (
        <span className="block text-right tabular">
          {formatNumber(r.candidate_count as number)}
        </span>
      ),
      aufgaben: (
        <span className="block text-right tabular">
          {formatNumber(r.open_task_count as number)}
        </span>
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
  }));

  return (
    <>
      <PageHeader
        title="Mitarbeiter"
        description="Zugänge, Rollen und Arbeitslast des internen Teams verwalten."
        actions={
          canCreate ? (
            <CreateEmployeeDialog
              roles={roleOptions}
              canCreateSuperadmin={actorIsSuperadmin}
              initialOpen={firstParam(params.neu) === "1"}
            />
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
