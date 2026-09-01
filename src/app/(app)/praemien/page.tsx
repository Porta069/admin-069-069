import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { backfillPayouts, payoutAutoAktiv } from "@/lib/payouts";
import {
  readTableParams, safeSort, firstParam, type SearchParams,
} from "@/lib/table-params";
import { formatDate, formatEuroCents, formatNumber } from "@/lib/format";
import { PAYOUT_STATUS, PAYOUT_ART } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  DataTable, type DataTableColumn, type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { CheckCircle2, Mail } from "lucide-react";
import { PayoutRowActions } from "./_components/payout-row-actions";
import { GeneratePayoutsButton, AutomationToggle } from "./_components/payout-toolbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prämien & Auszahlungen" };

const COLUMNS: DataTableColumn[] = [
  { key: "empfaenger", label: "Empfänger" },
  { key: "typ", label: "Typ" },
  { key: "kontext", label: "Bezug", defaultHidden: true },
  { key: "betrag", label: "Betrag", className: "text-right", sortable: true },
  { key: "status", label: "Status" },
  { key: "bank", label: "Zahlungsdaten" },
  { key: "beleg", label: "Beleg" },
  { key: "email", label: "E-Mail", defaultHidden: true },
  { key: "faellig", label: "Fällig", sortable: true },
  { key: "aktion", label: "", className: "w-12 text-right" },
];

function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  const c = iban.replace(/\s/g, "");
  return c.length < 4 ? "••••" : `•••• ${c.slice(-4)}`;
}

function kontextLink(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  if (entityType === "candidate") return `/kandidaten/${entityId}`;
  if (entityType === "referral") return "/affiliate";
  if (entityType === "placement") return "/vermittlungen";
  return null;
}

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("rewards");
  const canManage = can(employee, "rewards", "manage");

  // Register aus allen Quellen aktuell halten (idempotent).
  try { await backfillPayouts(); } catch (e) { console.error("backfillPayouts (render)", e); }

  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, { sort: "faellig" });
  const artFilter = firstParam(params.art);
  const statusFilter = firstParam(params.status);
  const offset = (page - 1) * pageSize;
  const like = q ? `%${q}%` : null;

  const where = sql`
    where po.deleted_at is null
      ${artFilter ? sql`and po.art = ${artFilter}` : sql``}
      ${statusFilter ? sql`and po.status = ${statusFilter}` : sql``}
      ${like ? sql`and po.recipient_name ilike ${like}` : sql``}`;

  const orderBy = safeSort(sort, { faellig: "po.due_at", betrag: "po.amount_cents" }, "po.due_at");
  const dirSql = dir === "asc" ? sql`asc` : sql`desc`;

  const [rows, [{ count }], [kpi], auto] = await Promise.all([
    sql`
      select po.id, po.art, po.status, po.recipient_name, po.recipient_email,
             po.amount_cents, po.bank_holder, po.bank_iban, po.bank_bic, po.method,
             po.invoice_id, po.entity_type, po.entity_id, po.due_at, po.email_sent_at,
             i.nummer as beleg_nr
      from admin.payout po
      left join admin.invoice i on i.id = po.invoice_id
      ${where}
      order by ${orderBy} ${dirSql} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int count from admin.payout po ${where}`,
    sql`
      select
        coalesce(sum(amount_cents) filter (where status = 'OFFEN'),0)::bigint offen,
        coalesce(sum(amount_cents) filter (where status = 'GENEHMIGT'),0)::bigint genehmigt,
        coalesce(sum(amount_cents) filter (where status = 'AUSGEZAHLT'),0)::bigint ausgezahlt,
        count(*) filter (where status in ('OFFEN','GENEHMIGT'))::int offen_count
      from admin.payout where deleted_at is null`,
    payoutAutoAktiv(),
  ]);

  const tableRows: DataTableRow[] = rows.map((r) => {
    const link = kontextLink(r.entity_type as string | null, r.entity_id as string | null);
    const iban = maskIban(r.bank_iban as string | null);
    return {
      id: r.id as string,
      cells: {
        empfaenger: <span className="font-medium">{r.recipient_name as string}</span>,
        typ: <StatusBadge map={PAYOUT_ART} value={r.art as string} withDot={false} />,
        kontext: link ? (
          <Link href={link} className="text-xs text-primary hover:underline">Öffnen</Link>
        ) : <span className="text-xs text-muted-foreground">—</span>,
        betrag: <span className="block text-right font-medium tabular">{formatEuroCents(r.amount_cents as number)}</span>,
        status: <StatusBadge map={PAYOUT_STATUS} value={r.status as string} />,
        bank: iban ? (
          <span className="text-sm">
            {(r.bank_holder as string) ?? "—"}
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">{iban}</span>
          </span>
        ) : <span className="text-xs text-muted-foreground">Keine Daten</span>,
        beleg: r.beleg_nr ? (
          <Link href={`/finanzen/${r.invoice_id as string}`} className="font-mono text-xs text-primary hover:underline">
            {r.beleg_nr as string}
          </Link>
        ) : <span className="text-xs text-muted-foreground">—</span>,
        email: r.email_sent_at ? (
          <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> gesendet</span>
        ) : r.recipient_email ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3.5" /> bereit</span>
        ) : <span className="text-xs text-muted-foreground">keine Adresse</span>,
        faellig: <span className="tabular text-muted-foreground">{formatDate(r.due_at as string | null)}</span>,
        aktion: canManage ? (
          <PayoutRowActions p={{
            id: r.id as string, art: r.art as string, status: r.status as string,
            recipientName: r.recipient_name as string, amountCents: r.amount_cents as number,
            recipientEmail: r.recipient_email as string | null,
            bankHolder: r.bank_holder as string | null, bankIban: r.bank_iban as string | null,
            bankBic: r.bank_bic as string | null, method: r.method as string | null,
            invoiceId: r.invoice_id as string | null,
          }} />
        ) : null,
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Prämien & Auszahlungen"
        description="Empfehlungsprämien, Affiliate-Boni und Treueprämien — genehmigen, auszahlen, Beleg & E-Mail."
        actions={canManage ? <GeneratePayoutsButton /> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard accent label="Offen" value={formatEuroCents(Number(kpi.offen))} hint="noch nicht genehmigt/ausgezahlt" />
        <KpiCard label="Genehmigt" value={formatEuroCents(Number(kpi.genehmigt))} hint="wartet auf Auszahlung" />
        <KpiCard label="Ausgezahlt gesamt" value={formatEuroCents(Number(kpi.ausgezahlt))} />
        <KpiCard label="Offene Vorgänge" value={formatNumber(kpi.offen_count as number)} />
      </div>

      {canManage && (
        <div className="mb-5">
          <AutomationToggle initial={auto} />
        </div>
      )}

      <DataTable
        tableId="payouts"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Empfänger suchen…"
        emptyTitle="Keine Auszahlungen"
        emptyDescription="Sobald Prämien anfallen (Vermittlung, Affiliate, Treueprämie), erscheinen sie hier automatisch."
        toolbar={
          <>
            <FilterSelect param="art" placeholder="Alle Typen"
              options={Object.entries(PAYOUT_ART).map(([value, d]) => ({ value, label: d.label }))} />
            <FilterSelect param="status" placeholder="Alle Status"
              options={Object.entries(PAYOUT_STATUS).map(([value, d]) => ({ value, label: d.label }))} />
          </>
        }
      />
    </>
  );
}
