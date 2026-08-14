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
import { REWARD_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Settings, Wallet } from "lucide-react";
import { MarkPaidButton } from "./_components/mark-paid-button";
import { CreateSettlementButton } from "./_components/create-settlement-button";

const COLUMNS: DataTableColumn[] = [
  { key: "partner", label: "Partner" },
  { key: "kandidat", label: "Referral / Kandidat" },
  { key: "betrag", label: "Betrag", className: "text-right" },
  { key: "status", label: "Status" },
  { key: "verdient", label: "Verdient am", sortable: true },
  { key: "bezahlt", label: "Bezahlt am", sortable: true },
  { key: "auszahlung", label: "Auszahlungsdaten" },
  { key: "aktion", label: "" },
];

function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  const compact = iban.replace(/\s/g, "");
  if (compact.length < 4) return "••••";
  return `•••• ${compact.slice(-4)}`;
}

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("rewards");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "verdient",
  });
  const statusFilter = firstParam(params.status); // DUE | PAID
  const canManage = can(employee, "rewards", "manage");

  const pricingRows = await sql`select value from admin.setting where key = 'pricing'`;
  const pricing = (pricingRows[0]?.value ?? {}) as Record<string, unknown>;
  const fallbackRewardCents =
    typeof pricing.referral_reward_cents === "number"
      ? pricing.referral_reward_cents
      : 10000;

  const orderBy = safeSort(
    sort,
    { verdient: `r."placedAt"`, bezahlt: `r."paidAt"` },
    `r."placedAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;
  const platformStatus =
    statusFilter === "DUE" ? "PLACED" : statusFilter === "PAID" ? "PAID" : null;

  const [rows, [{ count }], [kpi]] = await Promise.all([
    sql`
      select r.id, r."candidateName", r."candidateTrade", r.status,
             r."rewardCents", r."placedAt", r."paidAt",
             p.name as partner_name, p."payoutHolder", p."payoutIban"
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where r.status in ('PLACED', 'PAID')
        ${q ? sql`and (r."candidateName" ilike ${like} or p.name ilike ${like})` : sql``}
        ${platformStatus ? sql`and r.status = ${platformStatus}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where r.status in ('PLACED', 'PAID')
        ${q ? sql`and (r."candidateName" ilike ${like} or p.name ilike ${like})` : sql``}
        ${platformStatus ? sql`and r.status = ${platformStatus}` : sql``}`,
    sql`
      select
        coalesce(sum(
          case when status = 'PLACED'
               then case when coalesce("rewardCents", 0) = 0
                         then ${fallbackRewardCents}::int
                         else "rewardCents" end
               else 0 end
        ), 0)::bigint as due_total,
        coalesce(sum(
          case when status = 'PAID'
               then case when coalesce("rewardCents", 0) = 0
                         then ${fallbackRewardCents}::int
                         else "rewardCents" end
               else 0 end
        ), 0)::bigint as paid_total,
        count(*) filter (where status = 'PLACED')::int as open_count
      from public."Referral"
      where status in ('PLACED', 'PAID')`,
  ]);

  let usesFallback = false;

  const tableRows: DataTableRow[] = rows.map((r) => {
    const raw = r.rewardCents != null ? Number(r.rewardCents) : 0;
    const isFallback = raw <= 0;
    if (isFallback) usesFallback = true;
    const amount = isFallback ? fallbackRewardCents : raw;
    const derivedStatus = r.status === "PLACED" ? "DUE" : "PAID";
    const iban = maskIban(r.payoutIban as string | null);
    const holder = r.payoutHolder as string | null;

    return {
      id: r.id as string,
      cells: {
        partner: (
          <span className="font-medium">
            {(r.partner_name as string | null) ?? "—"}
          </span>
        ),
        kandidat: (
          <span>
            {(r.candidateName as string | null) ?? "—"}
            {r.candidateTrade && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {r.candidateTrade as string}
              </span>
            )}
          </span>
        ),
        betrag: (
          <span className="font-medium tabular">
            {formatEuroCents(amount)}
            {isFallback && <span className="text-muted-foreground">&thinsp;*</span>}
          </span>
        ),
        status: <StatusBadge map={REWARD_STATUS} value={derivedStatus} />,
        verdient: (
          <span className="tabular">{formatDate(r.placedAt as string | null)}</span>
        ),
        bezahlt: (
          <span className="tabular">{formatDate(r.paidAt as string | null)}</span>
        ),
        auszahlung:
          holder || iban ? (
            <span className="text-sm">
              {holder ?? "—"}
              {iban && (
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  {iban}
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Keine Bankdaten hinterlegt
            </span>
          ),
        aktion: canManage ? (
          <div className="flex items-center justify-end gap-1.5">
            <CreateSettlementButton referralId={r.id as string} />
            {r.status === "PLACED" && (
              <MarkPaidButton referralId={r.id as string} />
            )}
          </div>
        ) : null,
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Prämien"
        description="Wer hat sich eine Empfehlungsprämie verdient — und wer wurde schon ausgezahlt?"
      />

      <div className="mb-5 flex items-center gap-2.5 rounded-lg border bg-card px-4 py-3 text-sm">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Wallet className="size-4" />
        </span>
        <p className="text-muted-foreground">
          Aktuelle Prämienhöhe:{" "}
          <strong className="font-semibold text-foreground tabular">
            {formatEuroCents(fallbackRewardCents)}
          </strong>{" "}
          je erfolgreich vermitteltem Referral.
        </p>
        <Link
          href="/einstellungen"
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <Settings className="size-3.5" />
          In den Einstellungen anpassen
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Fällig gesamt"
          value={formatEuroCents(Number(kpi.due_total))}
          hint="vermittelt, noch nicht ausgezahlt"
          accent
        />
        <KpiCard
          label="Ausgezahlt gesamt"
          value={formatEuroCents(Number(kpi.paid_total))}
          hint="bereits überwiesen"
        />
        <KpiCard
          label="Offene Auszahlungen"
          value={formatNumber(kpi.open_count as number)}
          hint="warten auf Überweisung"
        />
      </div>

      <DataTable
        tableId="praemien"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Kandidat oder Partner…"
        emptyTitle="Keine Prämien fällig"
        emptyDescription="Sobald ein Referral erfolgreich vermittelt wurde, erscheint die fällige Prämie hier."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={[
              { value: "DUE", label: "Fällig" },
              { value: "PAID", label: "Bezahlt" },
            ]}
          />
        }
      />

      {usesFallback && (
        <p className="mt-2 text-xs text-muted-foreground">
          * Referral ohne hinterlegten Betrag — angezeigt wird die
          Standard-Prämie aus den Einstellungen.
        </p>
      )}
    </>
  );
}
