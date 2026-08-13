import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatEuroCents } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS } from "./_components/status";
import {
  CreateInvoiceDialog,
  type PlacementOption,
} from "./_components/create-invoice-dialog";
import { InvoiceActions } from "./_components/invoice-actions";

const COLUMNS: DataTableColumn[] = [
  { key: "nummer", label: "Nummer", sortable: true },
  { key: "unternehmen", label: "Unternehmen" },
  { key: "betrag", label: "Betrag", sortable: true, className: "text-right" },
  { key: "status", label: "Status" },
  { key: "ausgestellt", label: "Ausgestellt", sortable: true },
  { key: "faellig", label: "Fällig", sortable: true },
  { key: "bezahlt", label: "Bezahlt am" },
  { key: "aktion", label: "" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("rewards");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "ausgestellt",
  });
  const status = firstParam(params.status);

  const canCreate = can(employee, "rewards", "create");
  const canEdit = can(employee, "rewards", "edit");

  const orderBy = safeSort(
    sort,
    {
      nummer: "nummer",
      betrag: "total_cents",
      ausgestellt: "issued_at",
      faellig: "due_at",
    },
    "issued_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [
    rows,
    [{ count }],
    [openAmount],
    [overdueAmount],
    [paidMonth],
    [pipeline],
    pricingRows,
  ] = await Promise.all([
    sql`
      select i.*
      from admin.invoice i
      where i.deleted_at is null
        ${
          q
            ? sql`and (i.nummer ilike ${like} or i.company_name ilike ${like})`
            : sql``
        }
        ${status ? sql`and i.status = ${status}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.invoice i
      where i.deleted_at is null
        ${
          q
            ? sql`and (i.nummer ilike ${like} or i.company_name ilike ${like})`
            : sql``
        }
        ${status ? sql`and i.status = ${status}` : sql``}`,
    sql`select coalesce(sum(total_cents), 0)::bigint as total
        from admin.invoice
        where deleted_at is null and status in ('OFFEN', 'UEBERFAELLIG')`,
    sql`select coalesce(sum(total_cents), 0)::bigint as total
        from admin.invoice
        where deleted_at is null
          and (status = 'UEBERFAELLIG'
               or (status = 'OFFEN' and due_at is not null and due_at < now()))`,
    sql`select coalesce(sum(total_cents), 0)::bigint as total
        from admin.invoice
        where deleted_at is null and status = 'BEZAHLT'
          and paid_at >= date_trunc('month', now())`,
    sql`
      with pipe as (
        select count(*)::int as n
        from admin.proposal
        where deleted_at is null and status in ('ANGEBOT', 'ANGENOMMEN')
      ), avg_comm as (
        select coalesce(round(avg(commission_cents)), 0)::bigint as avg_c
        from admin.placement
        where deleted_at is null and status <> 'CANCELLED'
      )
      select pipe.n as n, avg_comm.avg_c as avg_c from pipe, avg_comm`,
    sql`select value from admin.setting where key = 'pricing'`,
  ]);

  const pricing = (pricingRows[0]?.value ?? {}) as Record<string, unknown>;
  const baseFeeCents =
    typeof pricing.base_fee_cents === "number" ? pricing.base_fee_cents : 4900;

  const pipelineCount = Number(pipeline?.n ?? 0);
  const avgCommission = Number(pipeline?.avg_c ?? 0);
  const pipelineRevenue = pipelineCount * (avgCommission + baseFeeCents);

  // Vermittlungen ohne (aktive) Rechnung — nur laden, wenn Dialog gezeigt wird.
  const placementRows = canCreate
    ? await sql`
        select pl.id, pl.candidate_name, pl.company_name, pl.job_title,
               pl.base_fee_cents, pl.commission_cents
        from admin.placement pl
        where pl.deleted_at is null and pl.status <> 'CANCELLED'
          and not exists (
            select 1 from admin.invoice i
            where i.placement_id = pl.id and i.deleted_at is null
              and i.status <> 'STORNIERT'
          )
        order by pl.placed_at desc
        limit 300`
    : [];

  const placementOptions: PlacementOption[] = placementRows.map((p) => ({
    id: p.id as string,
    label: `${p.candidate_name as string} → ${(p.company_name as string | null) ?? "—"}`,
    hint: (p.job_title as string | null) ?? "",
    baseFeeCents: Number(p.base_fee_cents ?? 0),
    commissionCents: Number(p.commission_cents ?? 0),
  }));

  const now = Date.now();
  const tableRows: DataTableRow[] = rows.map((r) => {
    const dueAt = r.due_at ? new Date(r.due_at as string) : null;
    const overdue =
      r.status === "UEBERFAELLIG" ||
      (r.status === "OFFEN" && dueAt !== null && dueAt.getTime() < now);
    return {
      id: r.id as string,
      href: `/finanzen/${r.id as string}`,
      cells: {
        nummer: (
          <Link
            href={`/finanzen/${r.id as string}`}
            className="font-mono text-sm font-medium hover:underline"
          >
            {r.nummer as string}
          </Link>
        ),
        unternehmen: r.company_id ? (
          <Link href={`/unternehmen/${r.company_id}`} className="hover:underline">
            {(r.company_name as string | null) ?? "—"}
          </Link>
        ) : (
          ((r.company_name as string | null) ?? "—")
        ),
        betrag: (
          <span className="font-medium tabular">
            {formatEuroCents(Number(r.total_cents ?? 0))}
          </span>
        ),
        status: <StatusBadge map={INVOICE_STATUS} value={r.status as string} />,
        ausgestellt: (
          <span className="tabular">{formatDate(r.issued_at as string)}</span>
        ),
        faellig: (
          <span className={cn("tabular", overdue && "font-medium text-destructive")}>
            {formatDate(r.due_at as string | null)}
          </span>
        ),
        bezahlt: r.paid_at ? (
          <span className="tabular">{formatDate(r.paid_at as string)}</span>
        ) : (
          "—"
        ),
        aktion: canEdit ? (
          <InvoiceActions id={r.id as string} status={r.status as string} />
        ) : null,
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Finanzen & Rechnungen"
        description="Rechnungen aus Vermittlungen, Zahlungsstatus und erwarteter Pipeline-Umsatz."
        actions={
          canCreate ? (
            <CreateInvoiceDialog placements={placementOptions} />
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Offener Betrag"
          value={formatEuroCents(Number(openAmount.total))}
          hint="offen + überfällig"
        />
        <KpiCard
          label="Überfällig"
          value={formatEuroCents(Number(overdueAmount.total))}
          hint="über Zahlungsziel"
        />
        <KpiCard
          label="Bezahlt (Monat)"
          value={formatEuroCents(Number(paidMonth.total))}
          hint="Zahlungseingang lfd. Monat"
        />
        <KpiCard
          label="Erwarteter Pipeline-Umsatz"
          value={formatEuroCents(pipelineRevenue)}
          hint={`${pipelineCount} Angebote × Ø-Wert`}
          accent
        />
      </div>

      <DataTable
        tableId="finanzen"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Rechnungsnummer oder Unternehmen…"
        emptyTitle="Noch keine Rechnungen"
        emptyDescription="Erstelle aus einer Vermittlung die erste Rechnung."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={Object.entries(INVOICE_STATUS).map(([value, def]) => ({
              value,
              label: def.label,
            }))}
          />
        }
      />
    </>
  );
}
