import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatEuroCents, formatNumber } from "@/lib/format";
import { PLACEMENT_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "../_shared/export-button";
import {
  CreatePlacementDialog,
  type JobOption,
} from "./_components/create-placement-dialog";
import { PlacementStatusMenu } from "./_components/placement-status-menu";

const COLUMNS: DataTableColumn[] = [
  { key: "kandidat", label: "Kandidat", sortable: true },
  { key: "unternehmen", label: "Unternehmen" },
  { key: "stelle", label: "Stelle" },
  { key: "status", label: "Status" },
  { key: "vermittelt", label: "Vermittelt am", sortable: true },
  { key: "grundgebuehr", label: "Grundgebühr", className: "text-right" },
  { key: "provision", label: "Provision", className: "text-right" },
  { key: "gesamt", label: "Gesamt", sortable: true, className: "text-right" },
  { key: "mitarbeiter", label: "Mitarbeiter" },
  { key: "referral", label: "Referral", defaultHidden: true },
  { key: "aktion", label: "" },
];

export default async function PlacementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("placements");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "vermittelt",
  });
  const status = firstParam(params.status);

  const canCreate = can(employee, "placements", "create");
  const canEdit = can(employee, "placements", "edit");

  const orderBy = safeSort(
    sort,
    {
      kandidat: "candidate_name",
      vermittelt: "placed_at",
      gesamt: "(base_fee_cents + coalesce(commission_cents, 0))",
    },
    "placed_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [
    rows,
    [{ count }],
    [monthCount],
    [weekCount],
    [monthRevenue],
    [openInvoices],
    pricingRows,
  ] = await Promise.all([
    sql`
      select pl.*, e.name as employee_name, e.avatar_color
      from admin.placement pl
      left join admin.employee e on e.id = pl.employee_id
      where pl.deleted_at is null
        ${
          q
            ? sql`and (pl.candidate_name ilike ${like} or pl.company_name ilike ${like} or coalesce(pl.job_title, '') ilike ${like})`
            : sql``
        }
        ${status ? sql`and pl.status = ${status}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.placement pl
      where pl.deleted_at is null
        ${
          q
            ? sql`and (pl.candidate_name ilike ${like} or pl.company_name ilike ${like} or coalesce(pl.job_title, '') ilike ${like})`
            : sql``
        }
        ${status ? sql`and pl.status = ${status}` : sql``}`,
    sql`select count(*)::int as count from admin.placement
        where deleted_at is null and status <> 'CANCELLED'
          and placed_at >= date_trunc('month', now())`,
    sql`select count(*)::int as count from admin.placement
        where deleted_at is null and status <> 'CANCELLED'
          and placed_at >= date_trunc('week', now())`,
    sql`select coalesce(sum(base_fee_cents + coalesce(commission_cents, 0)), 0)::bigint as total
        from admin.placement
        where deleted_at is null and status <> 'CANCELLED'
          and placed_at >= date_trunc('month', now())`,
    sql`select count(*)::int as count from admin.placement
        where deleted_at is null and status = 'PLACED'`,
    sql`select value from admin.setting where key = 'pricing'`,
  ]);

  const pricing = (pricingRows[0]?.value ?? {}) as Record<string, unknown>;
  const baseFeeCents =
    typeof pricing.base_fee_cents === "number" ? pricing.base_fee_cents : 4900;
  const maxCommissionCents =
    typeof pricing.max_commission_cents === "number"
      ? pricing.max_commission_cents
      : 250000;

  // Auswahllisten nur laden, wenn der Dialog überhaupt gezeigt wird.
  const [candidateRows, companyRows, jobRows] = canCreate
    ? await Promise.all([
        sql`select id, "firstName" || ' ' || "lastName" as name, profession
            from admin.candidate
            where status <> 'ERASED'
            order by "createdAt" desc limit 300`,
        sql`select id, name, ort from public."Company" order by name asc limit 300`,
        sql`select id, title, "companyId" from public."JobPosting"
            where status <> 'ARCHIVED'
            order by "createdAt" desc limit 500`,
      ])
    : [[], [], []];

  const tableRows: DataTableRow[] = rows.map((r) => {
    const total =
      Number(r.base_fee_cents ?? 0) + Number(r.commission_cents ?? 0);
    return {
      id: r.id as string,
      cells: {
        kandidat: r.application_id ? (
          <Link
            href={`/kandidaten/${r.application_id}`}
            className="font-medium hover:underline"
          >
            {r.candidate_name as string}
          </Link>
        ) : (
          <span className="font-medium">{r.candidate_name as string}</span>
        ),
        unternehmen: r.company_id ? (
          <Link
            href={`/unternehmen/${r.company_id}`}
            className="hover:underline"
          >
            {r.company_name as string}
          </Link>
        ) : (
          ((r.company_name as string | null) ?? "—")
        ),
        stelle: (r.job_title as string | null) ?? "—",
        status: <StatusBadge map={PLACEMENT_STATUS} value={r.status as string} />,
        vermittelt: (
          <span className="tabular">{formatDate(r.placed_at as string)}</span>
        ),
        grundgebuehr: (
          <span className="tabular">
            {formatEuroCents(Number(r.base_fee_cents ?? 0))}
          </span>
        ),
        provision: (
          <span className="tabular">
            {formatEuroCents(Number(r.commission_cents ?? 0))}
          </span>
        ),
        gesamt: (
          <span className="font-medium tabular">{formatEuroCents(total)}</span>
        ),
        mitarbeiter: r.employee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={r.employee_name as string}
              color={r.avatar_color as string | null}
              size="sm"
            />
            <span className="text-sm">{r.employee_name as string}</span>
          </span>
        ) : (
          "—"
        ),
        referral: r.referral_id ? (
          <Badge variant="secondary">Partner</Badge>
        ) : (
          "—"
        ),
        aktion: canEdit ? (
          <PlacementStatusMenu id={r.id as string} status={r.status as string} />
        ) : null,
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Vermittlungen"
        description="Erfolgreiche Vermittlungen, Rechnungsstatus und Umsatz im Blick."
        actions={
          <>
            {can(employee, "placements", "export") && (
              <ExportButton modul="vermittlungen" />
            )}
            {canCreate ? (
              <CreatePlacementDialog
                candidates={candidateRows.map((c) => ({
                  value: c.id as string,
                  label: c.name as string,
                  hint: (c.profession as string | null) ?? undefined,
                }))}
                companies={companyRows.map((c) => ({
                  value: c.id as string,
                  label: c.name as string,
                  hint: (c.ort as string | null) ?? undefined,
                }))}
                jobs={jobRows.map(
                  (j): JobOption => ({
                    id: j.id as string,
                    title: j.title as string,
                    companyId: j.companyId as string,
                  }),
                )}
                baseFeeCents={baseFeeCents}
                maxCommissionCents={maxCommissionCents}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Diesen Monat"
          value={formatNumber(monthCount.count as number)}
          hint="Vermittlungen, o. Storno"
        />
        <KpiCard
          label="Diese Woche"
          value={formatNumber(weekCount.count as number)}
          hint="seit Montag"
        />
        <KpiCard
          label="Umsatz diesen Monat"
          value={formatEuroCents(Number(monthRevenue.total))}
          hint="Gebühr + Provision"
          accent
        />
        <KpiCard
          label="Offene Rechnungen"
          value={formatNumber(openInvoices.count as number)}
          hint="Status „Vermittelt“"
        />
      </div>

      <DataTable
        tableId="vermittlungen"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Kandidat, Unternehmen oder Stelle…"
        emptyTitle="Noch keine Vermittlungen"
        emptyDescription="Sobald die erste Vermittlung erfasst ist, erscheint sie hier."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={Object.entries(PLACEMENT_STATUS).map(([value, def]) => ({
              value,
              label: def.label,
            }))}
          />
        }
      />
    </>
  );
}
