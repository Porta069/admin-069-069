import Link from "next/link";
import { Plus } from "lucide-react";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailerConfigured } from "@/lib/mailer";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatNumber } from "@/lib/format";
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
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STATUS, formatAudience } from "./campaign-defs";
import { MailerNotice } from "./_components/mailer-notice";

const COLUMNS: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "zielgruppe", label: "Empfängergruppe" },
  { key: "status", label: "Status" },
  { key: "empfaenger", label: "Empfänger", sortable: true, className: "text-right" },
  { key: "versendet", label: "Versendet", className: "text-right" },
  { key: "erstellt_von", label: "Erstellt von" },
  { key: "erstellt_am", label: "Erstellt am", sortable: true },
];

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("communication");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "erstellt_am",
  });
  const status = firstParam(params.status);

  const canCreate = can(employee, "communication", "create");

  const orderBy = safeSort(
    sort,
    {
      name: "c.name",
      empfaenger: "c.recipient_count",
      erstellt_am: "c.created_at",
    },
    "c.created_at",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [rows, [{ count }], [kpis]] = await Promise.all([
    sql`
      select c.*, e.name as creator_name, e.avatar_color
      from admin.campaign c
      left join admin.employee e on e.id = c.created_by
      where c.deleted_at is null
        ${q ? sql`and (c.name ilike ${like} or coalesce(c.subject, '') ilike ${like})` : sql``}
        ${status ? sql`and c.status = ${status}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.campaign c
      where c.deleted_at is null
        ${q ? sql`and (c.name ilike ${like} or coalesce(c.subject, '') ilike ${like})` : sql``}
        ${status ? sql`and c.status = ${status}` : sql``}`,
    sql`
      select
        (select count(*)::int from admin.campaign where deleted_at is null) as campaigns,
        (select coalesce(sum(sent_count), 0)::int from admin.campaign where deleted_at is null) as sent,
        (select count(*)::int from admin.outbox_email where status = 'PENDING') as pending,
        (select count(*)::int from admin.outbox_email where status = 'FAILED') as failed`,
  ]);

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    href: `/kampagnen/${r.id}`,
    cells: {
      name: <span className="font-medium">{r.name as string}</span>,
      zielgruppe: (
        <span className="text-muted-foreground">{formatAudience(r.audience)}</span>
      ),
      status: <StatusBadge map={CAMPAIGN_STATUS} value={r.status as string} />,
      empfaenger: (
        <span className="tabular">{formatNumber(r.recipient_count as number)}</span>
      ),
      versendet: (
        <span className="tabular">
          {formatNumber(r.sent_count as number)}
          <span className="text-muted-foreground">
            {" "}
            / {formatNumber(r.recipient_count as number)}
          </span>
        </span>
      ),
      erstellt_von: r.creator_name ? (
        <span className="inline-flex items-center gap-2">
          <EmployeeAvatar
            name={r.creator_name as string}
            color={r.avatar_color as string | null}
            size="sm"
          />
          <span className="text-sm">{r.creator_name as string}</span>
        </span>
      ) : (
        "—"
      ),
      erstellt_am: (
        <span className="tabular">{formatDate(r.created_at as string)}</span>
      ),
    },
  }));

  return (
    <>
      <PageHeader
        title="Kampagnen"
        description="Marketingkampagnen und Rundmails an Kandidaten, Unternehmen und Partner."
        actions={
          canCreate ? (
            <Button size="sm" asChild>
              <Link href="/kampagnen/neu">
                <Plus className="size-4" />
                Kampagne erstellen
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!mailerConfigured() && <MailerNotice className="mb-5" />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Kampagnen gesamt"
          value={formatNumber(kpis.campaigns as number)}
        />
        <KpiCard
          label="Versendet"
          value={formatNumber(kpis.sent as number)}
          hint="E-Mails über alle Kampagnen"
          accent
        />
        <KpiCard
          label="In Outbox wartend"
          value={formatNumber(kpis.pending as number)}
          hint="werden automatisch versendet"
        />
        <KpiCard
          label="Fehlgeschlagen"
          value={formatNumber(kpis.failed as number)}
          hint="Zustellfehler in der Outbox"
        />
      </div>

      <DataTable
        tableId="kampagnen"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Name oder Betreff…"
        emptyTitle="Noch keine Kampagnen"
        emptyDescription="Erstelle die erste Kampagne, um Kandidaten, Unternehmen oder Partner per Rundmail zu erreichen."
        toolbar={
          <FilterSelect
            param="status"
            placeholder="Alle Status"
            options={Object.entries(CAMPAIGN_STATUS).map(([value, def]) => ({
              value,
              label: def.label,
            }))}
          />
        }
      />
    </>
  );
}
