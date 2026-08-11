import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MailX } from "lucide-react";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { mailerConfigured } from "@/lib/mailer";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDateTime, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/common/status-badge";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { EmptyState } from "@/components/common/empty-state";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CAMPAIGN_STATUS,
  OUTBOX_STATUS,
  formatAudience,
} from "../campaign-defs";
import { MailerNotice } from "../_components/mailer-notice";
import { CancelCampaignDialog } from "../_components/cancel-campaign-dialog";

const RECIPIENT_COLUMNS: DataTableColumn[] = [
  { key: "email", label: "E-Mail", sortable: true },
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "fehler", label: "Fehler" },
  { key: "versendet_am", label: "Versendet am", sortable: true },
];

/** Variablen wie {first_name} im Text farbig hervorheben (Server-Render). */
function highlightVars(text: string): React.ReactNode {
  return text.split(/(\{[a-z_]+\})/g).map((part, i) =>
    /^\{[a-z_]+\}$/.test(part) ? (
      <span
        key={i}
        className="rounded-sm bg-primary/10 px-0.5 font-mono text-[0.85em] font-medium text-primary"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("communication");
  const { id } = await params;
  const sp = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(sp, {
    sort: "email",
    dir: "asc",
  });
  const outboxStatus = firstParam(sp.status);

  const [campaign] = await sql`
    select c.*, e.name as creator_name, e.avatar_color
    from admin.campaign c
    left join admin.employee e on e.id = c.created_by
    where c.id = ${id} and c.deleted_at is null
    limit 1`;
  if (!campaign) notFound();

  const orderBy = safeSort(
    sort,
    { email: "to_email", versendet_am: "sent_at" },
    "to_email",
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const [recipients, [{ count }], [outboxStats]] = await Promise.all([
    sql`
      select id, to_email, to_name, status, error, sent_at
      from admin.outbox_email
      where campaign_id = ${id}
        ${q ? sql`and (to_email ilike ${like} or coalesce(to_name, '') ilike ${like})` : sql``}
        ${outboxStatus ? sql`and status = ${outboxStatus}` : sql``}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`} nulls last
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.outbox_email
      where campaign_id = ${id}
        ${q ? sql`and (to_email ilike ${like} or coalesce(to_name, '') ilike ${like})` : sql``}
        ${outboxStatus ? sql`and status = ${outboxStatus}` : sql``}`,
    sql`
      select
        count(*) filter (where status = 'PENDING')::int as pending,
        count(*) filter (where status = 'FAILED')::int as failed,
        count(*) filter (where status = 'SKIPPED')::int as skipped
      from admin.outbox_email
      where campaign_id = ${id}`,
  ]);

  const status = campaign.status as string;
  const recipientCount = Number(campaign.recipient_count ?? 0);
  const sentCount = Number(campaign.sent_count ?? 0);
  const progress =
    recipientCount > 0 ? Math.round((sentCount / recipientCount) * 100) : 0;
  const cancellable = ["DRAFT", "SCHEDULED", "SENDING"].includes(status);
  const canCreate = can(employee, "communication", "create");
  const pendingCount = Number(outboxStats.pending ?? 0);

  const tableRows: DataTableRow[] = recipients.map((r) => ({
    id: r.id as string,
    cells: {
      email: <span className="font-medium">{r.to_email as string}</span>,
      name: (r.to_name as string | null) ?? "—",
      status: <StatusBadge map={OUTBOX_STATUS} value={r.status as string} />,
      fehler: r.error ? (
        <span
          className="block max-w-56 truncate text-xs text-destructive"
          title={r.error as string}
        >
          {r.error as string}
        </span>
      ) : (
        "—"
      ),
      versendet_am: (
        <span className="tabular">
          {r.sent_at ? formatDateTime(r.sent_at as string) : "—"}
        </span>
      ),
    },
  }));

  return (
    <>
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
        <div className="min-w-0">
          <Link
            href="/kampagnen"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Kampagnen
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-xl font-semibold tracking-tight">
              {campaign.name as string}
            </h1>
            <StatusBadge map={CAMPAIGN_STATUS} value={status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{formatAudience(campaign.audience)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <EmployeeAvatar
                name={campaign.creator_name as string | null}
                color={campaign.avatar_color as string | null}
                size="sm"
              />
              {(campaign.creator_name as string | null) ?? "Unbekannt"}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular">
              {formatDateTime(campaign.created_at as string)}
            </span>
          </div>
        </div>
        {cancellable && canCreate && (
          <CancelCampaignDialog
            campaignId={id}
            campaignName={campaign.name as string}
            pendingCount={pendingCount}
          />
        )}
      </div>

      {!mailerConfigured() && pendingCount > 0 && <MailerNotice className="mb-5" />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* Fortschritt */}
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">Versandfortschritt</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular">
                  {formatNumber(sentCount)}
                </span>{" "}
                von <span className="tabular">{formatNumber(recipientCount)}</span>{" "}
                versendet
              </p>
            </div>
            <Progress value={progress} className="mt-3" />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Wartend:{" "}
                <span className="font-medium text-foreground tabular">
                  {formatNumber(pendingCount)}
                </span>
              </span>
              <span>
                Fehlgeschlagen:{" "}
                <span className="font-medium text-foreground tabular">
                  {formatNumber(Number(outboxStats.failed ?? 0))}
                </span>
              </span>
              <span>
                Übersprungen:{" "}
                <span className="font-medium text-foreground tabular">
                  {formatNumber(Number(outboxStats.skipped ?? 0))}
                </span>
              </span>
            </div>
          </section>

          {/* Empfängerliste */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Empfänger</h2>
            {status === "DRAFT" ? (
              <EmptyState
                icon={MailX}
                title="Noch keine Empfänger"
                description="Die Kampagne ist ein Entwurf — Empfänger werden erst beim Versand aufgelöst und hier aufgelistet."
                action={
                  canCreate ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/kampagnen/neu">Neue Kampagne erstellen</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                tableId="kampagne-empfaenger"
                columns={RECIPIENT_COLUMNS}
                rows={tableRows}
                total={count as number}
                page={page}
                pageSize={pageSize}
                searchPlaceholder="E-Mail oder Name…"
                emptyTitle="Keine Empfänger gefunden"
                emptyDescription="Für die aktuelle Filterung gibt es keine Einträge."
                toolbar={
                  <FilterSelect
                    param="status"
                    placeholder="Alle Status"
                    options={Object.entries(OUTBOX_STATUS).map(
                      ([value, def]) => ({ value, label: def.label }),
                    )}
                  />
                }
              />
            )}
          </section>
        </div>

        {/* Inhalt der Mail */}
        <aside className="lg:sticky lg:top-6">
          <section className="overflow-hidden rounded-lg border bg-card">
            <header className="border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">Inhalt</h2>
              <p className="text-xs text-muted-foreground">
                Variablen werden pro Empfänger ersetzt.
              </p>
            </header>
            <div className="border-b bg-muted/40 px-5 py-3">
              <p className="text-xs text-muted-foreground">Betreff</p>
              <p className="mt-0.5 text-sm font-medium break-words">
                {campaign.subject
                  ? highlightVars(campaign.subject as string)
                  : "—"}
              </p>
            </div>
            <div className="max-h-[28rem] overflow-y-auto px-5 py-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {campaign.body ? highlightVars(campaign.body as string) : "—"}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
