import Link from "next/link";
import { Sparkles, UserRoundX } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate } from "@/lib/format";
import { COMPANY_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  type BulkAction,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "../_shared/export-button";
import { CreateCompanyDialog } from "./_components/create-company-dialog";
import {
  DeleteCompanyDialog,
  RestoreCompanyButton,
} from "./_components/delete-company-dialog";
import {
  archiveCompany,
  bulkAssignCompaniesToMe,
  bulkSetCompanyStatusAktiv,
  createCompany,
  deleteCompanyPermanently,
  getCompanyDeletionInfo,
  restoreCompany,
} from "./actions";

const SOURCE_LABELS: Record<string, string> = {
  SELF: "Selbst registriert",
  ADMIN: "Manuell angelegt",
  AI: "KI-Import",
};

interface CompanyRow {
  id: string;
  name: string;
  ort: string | null;
  plz: string | null;
  kontaktName: string | null;
  source: string | null;
  createdAt: Date;
  meta_status: string | null;
  archived_at: Date | null;
  assignee_name: string | null;
  assignee_color: string | null;
  active_jobs: number;
  total_applications: number;
}

const COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "ort", label: "Ort" },
  { key: "plz", label: "PLZ", defaultHidden: true },
  { key: "kontakt", label: "Kontakt" },
  { key: "status", label: "Status" },
  { key: "mitarbeiter", label: "Zuständig" },
  { key: "jobs", label: "Offene Jobs", className: "tabular" },
  { key: "bewerbungen", label: "Bewerbungen", className: "tabular" },
  { key: "quelle", label: "Quelle" },
  { key: "erstellt", label: "Erstellt", sortable: true },
];

const ACTION_COLUMN: DataTableColumn = {
  key: "aktionen",
  label: "",
  className: "w-0 text-right whitespace-nowrap",
};

export default async function UnternehmenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("companies");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "erstellt",
  });
  const status = firstParam(params.status);
  const quelle = firstParam(params.quelle);
  const ort = firstParam(params.ort);
  const tag = firstParam(params.tag);
  const archiv = firstParam(params.archiv);
  const initialDialogOpen = firstParam(params.neu) === "1";

  const orderBy = safeSort(
    sort,
    { name: `c.name`, erstellt: `c."createdAt"` },
    `c."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  // Archivierte per Default ausblenden („mit" = einblenden, „nur" = nur diese).
  const where = sql`
    where true
    ${
      archiv === "nur"
        ? sql`and cm.archived_at is not null`
        : archiv === "mit"
          ? sql``
          : sql`and cm.archived_at is null`
    }
    ${
      q
        ? sql`and (c.name ilike ${like} or c.ort ilike ${like} or c."kontaktName" ilike ${like})`
        : sql``
    }
    ${status ? sql`and coalesce(cm.status, 'NEU') = ${status}` : sql``}
    ${quelle ? sql`and c.source::text = ${quelle}` : sql``}
    ${ort ? sql`and c.ort = ${ort}` : sql``}
    ${
      tag
        ? sql`and exists (
            select 1 from admin.entity_tag et
            join admin.tag t on t.id = et.tag_id
            where et.entity_type = 'company' and et.entity_id = c.id
              and t.name = ${tag})`
        : sql``
    }`;

  const [rows, countRows, orte, tagOptions] = await Promise.all([
    sql<CompanyRow[]>`
      select c.id, c.name, c.ort, c.plz, c."kontaktName",
             c.source::text as source, c."createdAt",
             cm.status as meta_status, cm.archived_at,
             e.name as assignee_name, e.avatar_color as assignee_color,
             (select count(*)::int from public."JobPosting" j
              where j."companyId" = c.id and j.status = 'ACTIVE') as active_jobs,
             (select count(*)::int from public."JobApplication" ja
              join public."JobPosting" j2 on j2.id = ja."jobPostingId"
              where j2."companyId" = c.id) as total_applications
      from public."Company" c
      left join admin.company_meta cm on cm.company_id = c.id
      left join admin.employee e on e.id = cm.assignee_id and e.deleted_at is null
      ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql<{ count: number }[]>`
      select count(*)::int as count
      from public."Company" c
      left join admin.company_meta cm on cm.company_id = c.id
      ${where}`,
    sql<{ ort: string }[]>`
      select ort from public."Company"
      where ort is not null
      group by ort order by count(*) desc limit 30`,
    sql<{ name: string }[]>`
      select name from admin.tag order by name asc limit 100`,
  ]);
  const count = countRows[0]?.count ?? 0;
  const canDelete = can(employee, "companies", "delete");
  const columns = canDelete ? [...COLUMNS, ACTION_COLUMN] : COLUMNS;

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id,
    href: `/unternehmen/${r.id}`,
    cells: {
      name: <span className="font-medium">{r.name}</span>,
      ort: r.ort ?? "—",
      plz: r.plz ?? "—",
      kontakt: r.kontaktName ?? "—",
      status: (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge map={COMPANY_STATUS} value={r.meta_status ?? "NEU"} />
          {r.archived_at != null && (
            <Badge variant="secondary">Archiviert</Badge>
          )}
        </span>
      ),
      mitarbeiter: r.assignee_name ? (
        <span className="flex items-center gap-2">
          <EmployeeAvatar name={r.assignee_name} color={r.assignee_color} size="sm" />
          <span className="truncate">{r.assignee_name}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      jobs:
        r.active_jobs > 0 ? (
          <span className="font-medium">{r.active_jobs}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
      bewerbungen:
        r.total_applications > 0 ? (
          r.total_applications
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
      quelle: r.source ? (SOURCE_LABELS[r.source] ?? r.source) : "—",
      erstellt: <span className="tabular">{formatDate(r.createdAt)}</span>,
      ...(canDelete
        ? {
            aktionen: (
              <span className="flex items-center justify-end gap-1">
                {r.archived_at != null && (
                  <RestoreCompanyButton
                    companyId={r.id}
                    action={restoreCompany}
                    variant="ghost"
                  />
                )}
                <DeleteCompanyDialog
                  companyId={r.id}
                  getInfo={getCompanyDeletionInfo}
                  archiveAction={archiveCompany}
                  deleteAction={deleteCompanyPermanently}
                  trigger="icon"
                />
              </span>
            ),
          }
        : {}),
    },
  }));

  const bulkActions: BulkAction[] = [
    ...(can(employee, "companies", "assign")
      ? [{ label: "Mir zuweisen", action: bulkAssignCompaniesToMe }]
      : []),
    ...(can(employee, "companies", "edit")
      ? [{ label: "Status: Aktiv", action: bulkSetCompanyStatusAktiv }]
      : []),
  ];

  // Betriebs-Accounts (User role EMPLOYER), die (noch) kein Firmenprofil haben —
  // sonst wären sie im Dashboard unsichtbar.
  const orphanBetriebe = await sql<
    { id: string; firstName: string | null; lastName: string | null; email: string; companyName: string | null }[]
  >`
    select id, "firstName", "lastName", email, "companyName"
    from public."User"
    where role = 'EMPLOYER' and "companyId" is null
    order by "createdAt" desc
    limit 20`;

  return (
    <>
      <PageHeader
        title="Unternehmen"
        description="Betriebe akquirieren, betreuen und mit offenen Stellen im Blick behalten."
        actions={
          <>
            {can(employee, "companies", "export") && (
              <ExportButton modul="unternehmen" />
            )}
            {can(employee, "companies", "create") && (
              <Button variant="outline" size="sm" className="bg-card" asChild>
                <Link href="/unternehmen/ki">
                  <Sparkles className="size-4" />
                  Mit KI anlegen
                </Link>
              </Button>
            )}
            {can(employee, "companies", "create") && (
              <CreateCompanyDialog
                action={createCompany}
                initialOpen={initialDialogOpen}
              />
            )}
          </>
        }
      />
      {orphanBetriebe.length > 0 && (
        <Alert className="mb-5">
          <UserRoundX className="size-4" />
          <AlertTitle>
            {orphanBetriebe.length} Betriebs-Account
            {orphanBetriebe.length > 1 ? "s" : ""} ohne Firmenprofil
          </AlertTitle>
          <AlertDescription>
            <span>
              Diese registrierten Betriebe haben noch kein verknüpftes
              Firmenprofil und tauchen daher nicht in der Liste auf:
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {orphanBetriebe.map((b) => (
                <span key={b.id} className="text-foreground">
                  {b.companyName || `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim() || b.email}
                  <span className="text-muted-foreground"> · {b.email}</span>
                </span>
              ))}
            </span>
          </AlertDescription>
        </Alert>
      )}
      <DataTable
        tableId="unternehmen"
        columns={columns}
        rows={tableRows}
        total={count}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Name, Ort oder Kontakt…"
        emptyTitle="Keine Unternehmen gefunden"
        emptyDescription="Lege das erste Unternehmen über den Button oben rechts an oder passe die Filter an."
        bulkActions={bulkActions.length > 0 ? bulkActions : undefined}
        toolbar={
          <>
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={Object.entries(COMPANY_STATUS).map(([value, def]) => ({
                value,
                label: def.label,
              }))}
            />
            <FilterSelect
              param="quelle"
              placeholder="Alle Quellen"
              options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              className="h-9 w-40 bg-card"
            />
            <FilterSelect
              param="ort"
              placeholder="Alle Orte"
              options={orte.map((o) => ({ value: o.ort, label: o.ort }))}
              className="h-9 w-40 bg-card"
            />
            {tagOptions.length > 0 && (
              <FilterSelect
                param="tag"
                placeholder="Alle Tags"
                options={tagOptions.map((t) => ({
                  value: t.name,
                  label: t.name,
                }))}
                className="h-9 w-36 bg-card"
              />
            )}
            <FilterSelect
              param="archiv"
              placeholder="Ohne Archivierte"
              options={[
                { value: "mit", label: "Archivierte anzeigen" },
                { value: "nur", label: "Nur Archivierte" },
              ]}
              className="h-9 w-44 bg-card"
            />
          </>
        }
      />
    </>
  );
}
