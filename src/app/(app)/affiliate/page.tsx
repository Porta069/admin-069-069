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
import { REFERRAL_STATUS, type StatusDef } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { GitBranch, Users } from "lucide-react";
import { ExportButton } from "../_shared/export-button";
import { ReferralStatusMenu } from "./_components/referral-status-menu";
import { CopySlugButton } from "./_components/copy-slug-button";

const PARTNER_STATUS: Record<string, StatusDef> = {
  ACTIVE: { label: "Aktiv", tone: "success" },
  PENDING: { label: "Ausstehend", tone: "info" },
  INACTIVE: { label: "Inaktiv", tone: "neutral" },
  DISABLED: { label: "Deaktiviert", tone: "neutral" },
  BLOCKED: { label: "Gesperrt", tone: "danger" },
};

const REFERRAL_COLUMNS: DataTableColumn[] = [
  { key: "partner", label: "Partner" },
  { key: "kandidat", label: "Kandidat" },
  { key: "gewerk", label: "Gewerk" },
  { key: "status", label: "Status" },
  { key: "registriert", label: "Registriert", sortable: true },
  { key: "vermittelt", label: "Vermittelt am", sortable: true },
  { key: "ausgezahlt", label: "Ausgezahlt am", defaultHidden: true },
  { key: "praemie", label: "Prämie", sortable: true, className: "text-right" },
  { key: "aktion", label: "" },
];

const PARTNER_COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "slug", label: "Referral-Link" },
  { key: "email", label: "E-Mail" },
  { key: "telefon", label: "Telefon", defaultHidden: true },
  { key: "status", label: "Status" },
  { key: "referrals", label: "Referrals", sortable: true, className: "text-right" },
  { key: "placed", label: "Davon vermittelt", className: "text-right" },
  { key: "klicks", label: "Klicks", className: "text-right" },
  { key: "iban", label: "IBAN" },
  { key: "registriert", label: "Registriert", sortable: true },
];

export default async function AffiliatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("affiliates");
  const params = await searchParams;
  const tab = firstParam(params.tab) === "partner" ? "partner" : "referrals";
  const canManage = can(employee, "affiliates", "manage");

  const [[partnerTotal], [referralStats], [openRewards]] = await Promise.all([
    sql`select count(*)::int as count from public."Partner"`,
    sql`select count(*)::int as total,
               count(*) filter (where status in ('PLACED', 'PAID'))::int as placed
        from public."Referral"`,
    sql`select coalesce(sum("rewardCents"), 0)::bigint as total
        from public."Referral" where status = 'PLACED'`,
  ]);

  return (
    <>
      <PageHeader
        title="Affiliate / Partner"
        description="Empfehlungspartner und ihre Referrals — Statuswechsel laufen über die Plattform und lösen die Prämienlogik aus."
        actions={
          tab === "referrals" && can(employee, "affiliates", "export") ? (
            <ExportButton modul="referrals" />
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Partner"
          value={formatNumber(partnerTotal.count as number)}
          hint="gesamt"
        />
        <KpiCard
          label="Referrals"
          value={formatNumber(referralStats.total as number)}
          hint="gesamt"
        />
        <KpiCard
          label="Davon vermittelt"
          value={formatNumber(referralStats.placed as number)}
          hint="Status PLACED / PAID"
        />
        <KpiCard
          label="Offene Prämien"
          value={formatEuroCents(Number(openRewards.total))}
          hint="vermittelt, noch nicht ausgezahlt"
          href="/praemien"
          accent
        />
      </div>

      <div className="mb-4 flex items-center gap-1 border-b">
        <TabLink
          href="/affiliate"
          active={tab === "referrals"}
          icon={<GitBranch className="size-4" />}
          label="Referrals"
        />
        <TabLink
          href="/affiliate?tab=partner"
          active={tab === "partner"}
          icon={<Users className="size-4" />}
          label="Partner"
        />
      </div>

      {tab === "referrals" ? (
        <ReferralsTable params={params} canManage={canManage} />
      ) : (
        <PartnersTable params={params} />
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ── Tab 1: Referrals ──────────────────────────────────────────────────── */

async function ReferralsTable({
  params,
  canManage,
}: {
  params: SearchParams;
  canManage: boolean;
}) {
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "registriert",
  });
  const status = firstParam(params.status);
  const partnerId = firstParam(params.partner);

  const orderBy = safeSort(
    sort,
    {
      registriert: `r."createdAt"`,
      vermittelt: `r."placedAt"`,
      praemie: `r."rewardCents"`,
    },
    `r."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, [{ count }], partnerOptions] = await Promise.all([
    sql`
      select r.id, r."candidateName", r."candidateTrade", r.status,
             r."rewardCents", r."createdAt", r."placedAt", r."paidAt",
             p.name as partner_name
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where true
        ${q ? sql`and (r."candidateName" ilike ${like} or p.name ilike ${like})` : sql``}
        ${status ? sql`and r.status = ${status}` : sql``}
        ${partnerId ? sql`and r."partnerId" = ${partnerId}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from public."Referral" r
      left join public."Partner" p on p.id = r."partnerId"
      where true
        ${q ? sql`and (r."candidateName" ilike ${like} or p.name ilike ${like})` : sql``}
        ${status ? sql`and r.status = ${status}` : sql``}
        ${partnerId ? sql`and r."partnerId" = ${partnerId}` : sql``}`,
    sql`select id, name from public."Partner" order by name asc limit 200`,
  ]);

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    cells: {
      partner: (
        <span className="font-medium">
          {(r.partner_name as string | null) ?? "—"}
        </span>
      ),
      kandidat: (r.candidateName as string | null) ?? "—",
      gewerk: (r.candidateTrade as string | null) ?? "—",
      status: <StatusBadge map={REFERRAL_STATUS} value={r.status as string} />,
      registriert: (
        <span className="tabular">{formatDate(r.createdAt as string)}</span>
      ),
      vermittelt: (
        <span className="tabular">{formatDate(r.placedAt as string | null)}</span>
      ),
      ausgezahlt: (
        <span className="tabular">{formatDate(r.paidAt as string | null)}</span>
      ),
      praemie: (
        <span className="tabular">
          {r.rewardCents != null && Number(r.rewardCents) > 0
            ? formatEuroCents(Number(r.rewardCents))
            : "—"}
        </span>
      ),
      aktion: canManage ? (
        <ReferralStatusMenu id={r.id as string} status={r.status as string} />
      ) : null,
    },
  }));

  return (
    <DataTable
      tableId="affiliate-referrals"
      columns={REFERRAL_COLUMNS}
      rows={tableRows}
      total={count as number}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Kandidat oder Partner…"
      emptyTitle="Noch keine Referrals"
      emptyDescription="Sobald Partner Kandidaten werben, erscheinen die Referrals hier."
      toolbar={
        <>
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={Object.entries(REFERRAL_STATUS).map(([value, def]) => ({
              value,
              label: def.label,
            }))}
          />
          <FilterSelect
            param="partner"
            placeholder="Alle Partner"
            options={partnerOptions.map((p) => ({
              value: p.id as string,
              label: p.name as string,
            }))}
          />
        </>
      }
    />
  );
}

/* ── Tab 2: Partner ────────────────────────────────────────────────────── */

async function PartnersTable({ params }: { params: SearchParams }) {
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "registriert",
  });

  const orderBy = safeSort(
    sort,
    {
      name: "p.name",
      registriert: `p."createdAt"`,
      referrals: "referral_count",
    },
    `p."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, [{ count }]] = await Promise.all([
    sql`
      select p.id, p.name, p.slug, p.email, p.phone, p.status,
             p."payoutIban", p."createdAt",
             (select count(*)::int from public."Referral" r
              where r."partnerId" = p.id) as referral_count,
             (select count(*)::int from public."Referral" r
              where r."partnerId" = p.id and r.status in ('PLACED', 'PAID')) as placed_count,
             (select count(*)::int from public."ReferralClick" c
              where c.slug = p.slug) as click_count
      from public."Partner" p
      where true
        ${q ? sql`and (p.name ilike ${like} or p.email ilike ${like} or p.slug ilike ${like})` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from public."Partner" p
      where true
        ${q ? sql`and (p.name ilike ${like} or p.email ilike ${like} or p.slug ilike ${like})` : sql``}`,
  ]);

  const tableRows: DataTableRow[] = rows.map((p) => {
    const slug = p.slug as string;
    const url = `https://portawerk.de/r/${slug}`;
    return {
      id: p.id as string,
      cells: {
        name: <span className="font-medium">{p.name as string}</span>,
        slug: (
          <span className="inline-flex items-center gap-1">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              portawerk.de/r/{slug}
            </code>
            <CopySlugButton url={url} />
          </span>
        ),
        email: (p.email as string | null) ?? "—",
        telefon: (p.phone as string | null) ?? "—",
        status: <StatusBadge map={PARTNER_STATUS} value={p.status as string} />,
        referrals: (
          <span className="tabular">{formatNumber(p.referral_count as number)}</span>
        ),
        placed: (
          <span className="tabular">{formatNumber(p.placed_count as number)}</span>
        ),
        klicks: (
          <span className="tabular">{formatNumber(p.click_count as number)}</span>
        ),
        iban: p.payoutIban ? (
          <span className="text-success">Ja</span>
        ) : (
          <span className="text-muted-foreground">Nein</span>
        ),
        registriert: (
          <span className="tabular">{formatDate(p.createdAt as string)}</span>
        ),
      },
    };
  });

  return (
    <DataTable
      tableId="affiliate-partner"
      columns={PARTNER_COLUMNS}
      rows={tableRows}
      total={count as number}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Name, E-Mail oder Slug…"
      emptyTitle="Noch keine Partner"
      emptyDescription="Sobald sich der erste Empfehlungspartner registriert, erscheint er hier."
    />
  );
}
