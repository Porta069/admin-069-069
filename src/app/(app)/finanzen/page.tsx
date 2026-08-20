import Link from "next/link";
import type { ReactNode } from "react";
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
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INVOICE_STATUS, INVOICE_ART } from "./_components/status";
import {
  CreateInvoiceDialog,
  type PlacementOption,
} from "./_components/create-invoice-dialog";
import {
  AdvancedInvoiceDialog,
  type ReferralOption,
  type CompanyOption,
} from "./_components/advanced-invoice-dialog";
import { InvoiceActions } from "./_components/invoice-actions";

const COLUMNS: DataTableColumn[] = [
  { key: "nummer", label: "Nummer", sortable: true },
  { key: "art", label: "Art" },
  { key: "unternehmen", label: "Empfänger" },
  { key: "betrag", label: "Betrag", sortable: true, className: "text-right" },
  { key: "status", label: "Status" },
  { key: "ausgestellt", label: "Ausgestellt", sortable: true },
  { key: "faellig", label: "Fällig", sortable: true },
  { key: "bezahlt", label: "Bezahlt am" },
  { key: "aktion", label: "" },
];

function StatCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

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

  // Erweiterte Auswertungen: nach Rechnungsart, Umsatz je Monat, Top-Unternehmen.
  const [byArtRows, byMonthRows, topCompanyRows, [{ total: totalPaidAll }]] =
    await Promise.all([
      sql`select art, coalesce(sum(total_cents), 0)::bigint as total, count(*)::int as n
          from admin.invoice
          where deleted_at is null and status <> 'STORNIERT'
          group by art order by total desc`,
      sql`select to_char(date_trunc('month', paid_at), 'YYYY-MM') as monat,
                 coalesce(sum(total_cents), 0)::bigint as total
          from admin.invoice
          where deleted_at is null and status = 'BEZAHLT' and paid_at is not null
            and paid_at >= date_trunc('month', now()) - interval '5 months'
          group by 1 order by 1`,
      sql`select company_name, coalesce(sum(total_cents), 0)::bigint as total,
                 count(*)::int as n
          from admin.invoice
          where deleted_at is null and status <> 'STORNIERT'
            and company_name is not null
          group by company_name order by total desc limit 5`,
      sql`select coalesce(sum(total_cents), 0)::bigint as total
          from admin.invoice where deleted_at is null and status = 'BEZAHLT'`,
    ]);

  // Offene Empfehlungs-Vorgänge ohne Abrechnung + Unternehmen (für „Weitere Rechnung").
  const [referralRows, companyRows, jobRows] = canCreate
    ? await Promise.all([
        sql`select r.id, r."candidateName", r."candidateTrade", r."rewardCents",
                   p.name as partner_name
            from public."Referral" r
            left join public."Partner" p on p.id = r."partnerId"
            where not exists (
              select 1 from admin.invoice i
              where i.referral_id = r.id and i.deleted_at is null
                and i.status <> 'STORNIERT')
            order by r."createdAt" desc limit 200`,
        sql`select id, name from public."Company" order by name asc limit 300`,
        sql`select j.id, j.title, j."salaryMin", j."salaryMax", j."companyId",
                   c.name as company
            from public."JobPosting" j
            left join public."Company" c on c.id = j."companyId"
            order by j."createdAt" desc limit 300`,
      ])
    : [[], [], []];

  const provisionPercent =
    typeof pricing.provision_percent === "number" ? pricing.provision_percent : 20;
  const jobOptions = jobRows.map((j) => {
    const annual = j.salaryMax ?? j.salaryMin ?? null;
    return {
      value: j.id as string,
      label: `${j.title as string}${j.company ? ` · ${j.company as string}` : ""}`,
      companyId: (j.companyId as string | null) ?? null,
      companyName: (j.company as string | null) ?? null,
      salaryAnnualCents: annual != null ? Number(annual) * 100 : null,
    };
  });

  const referralOptions = referralRows.map((r) => ({
    id: r.id as string,
    label: `${(r.partner_name as string | null) ?? "Partner"} → ${(r.candidateName as string | null) ?? "Kandidat"}`,
    hint: `${formatEuroCents(Number(r.rewardCents ?? 0))}${r.candidateTrade ? ` · ${r.candidateTrade as string}` : ""}`,
  }));
  const companyOptions = companyRows.map((c) => ({
    value: c.id as string,
    label: c.name as string,
  }));

  const byArtMax = Math.max(1, ...byArtRows.map((r) => Number(r.total ?? 0)));
  const byMonthMax = Math.max(1, ...byMonthRows.map((r) => Number(r.total ?? 0)));

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
        art: <StatusBadge map={INVOICE_ART} value={(r.art as string) ?? "VERMITTLUNG"} withDot={false} />,
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
        description="Rechnungen, Abrechnungen und Auswertungen — Vermittlungen, Premium-Accounts und das Empfehlungsmodell."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="bg-card">
              <Link href="/finanzen/bank">
                <Landmark className="size-4" />
                Bankanbindung
              </Link>
            </Button>
            {canCreate && (
              <AdvancedInvoiceDialog
                referrals={referralOptions}
                companies={companyOptions}
                jobs={jobOptions}
                defaultProvisionPercent={provisionPercent}
              />
            )}
            {canCreate && <CreateInvoiceDialog placements={placementOptions} />}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Umsatz gesamt"
          value={formatEuroCents(Number(totalPaidAll))}
          hint="alle bezahlten Rechnungen"
          accent
        />
        <KpiCard
          label="Offene Forderungen"
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
      </div>

      {/* Auswertungen */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <StatCard title="Nach Rechnungsart">
          {byArtRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Rechnungen.</p>
          ) : (
            <ul className="space-y-2.5">
              {byArtRows.map((r) => {
                const t = Number(r.total ?? 0);
                const anteil = byArtMax > 0 ? Math.round((t / byArtMax) * 100) : 0;
                return (
                  <li key={r.art as string}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{INVOICE_ART[r.art as string]?.label ?? (r.art as string)}</span>
                      <span className="font-medium tabular">{formatEuroCents(t)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, anteil)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </StatCard>

        <StatCard title="Umsatz nach Monat">
          {byMonthRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Zahlungseingänge.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {byMonthRows.map((r) => {
                const t = Number(r.total ?? 0);
                const anteil = byMonthMax > 0 ? Math.round((t / byMonthMax) * 100) : 0;
                return (
                  <li key={r.monat as string}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="tabular">{r.monat as string}</span>
                      <span className="font-medium tabular">{formatEuroCents(t)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(3, anteil)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </StatCard>

        <StatCard title="Top-Unternehmen">
          {topCompanyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Rechnungen.</p>
          ) : (
            <ul className="divide-y">
              {topCompanyRows.map((r) => (
                <li
                  key={r.company_name as string}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="truncate">{r.company_name as string}</span>
                  <span className="font-medium tabular">
                    {formatEuroCents(Number(r.total ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Erwarteter Pipeline-Umsatz:{" "}
            <span className="font-medium text-foreground">
              {formatEuroCents(pipelineRevenue)}
            </span>{" "}
            ({pipelineCount} Angebote)
          </p>
        </StatCard>
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
