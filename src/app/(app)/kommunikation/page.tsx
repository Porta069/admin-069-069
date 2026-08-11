import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatDateTime } from "@/lib/format";
import {
  ENTITY_LABELS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
} from "lucide-react";
import { CommunicationLogDialog } from "./_components/log-dialog";

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  EMAIL: { label: "E-Mail", icon: <Mail className="size-4" /> },
  TELEFON: { label: "Telefon", icon: <Phone className="size-4" /> },
  WHATSAPP: { label: "WhatsApp", icon: <MessageCircle className="size-4" /> },
  SONSTIGE: { label: "Sonstige", icon: <MessageSquare className="size-4" /> },
};

const COLUMNS: DataTableColumn[] = [
  { key: "channel", label: "Kanal" },
  { key: "direction", label: "Richtung" },
  { key: "subject", label: "Betreff / Inhalt" },
  { key: "entity", label: "Verknüpft mit" },
  { key: "employee", label: "Mitarbeiter" },
  { key: "occurred", label: "Zeitpunkt", sortable: true },
];

export default async function KommunikationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("communication");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "occurred",
  });
  const kanal = firstParam(params.kanal);
  const richtung = firstParam(params.richtung);
  const ma = firstParam(params.ma);
  const initialOpen = firstParam(params.neu) === "1";

  const orderBy = safeSort(sort, { occurred: "c.occurred_at" }, "c.occurred_at");
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    c.deleted_at is null
    ${q ? sql`and (c.subject ilike ${like} or c.body ilike ${like})` : sql``}
    ${kanal ? sql`and c.channel = ${kanal}` : sql``}
    ${richtung ? sql`and c.direction = ${richtung}` : sql``}
    ${ma ? sql`and c.employee_id = ${ma}` : sql``}`;

  const [rows, [{ count }], [kpi], employees, candidates, companies] =
    await Promise.all([
      sql`
        select c.*, e.name as employee_name, e.avatar_color as employee_color
        from admin.communication c
        left join admin.employee e on e.id = c.employee_id
        where ${where}
        order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
        limit ${pageSize} offset ${offset}`,
      sql`select count(*)::int as count from admin.communication c where ${where}`,
      sql`
        select
          count(*)::int as total,
          count(*) filter (where occurred_at >= date_trunc('week', now()))::int as this_week,
          count(*) filter (where channel = 'EMAIL')::int as email,
          count(*) filter (where channel = 'TELEFON')::int as phone
        from admin.communication
        where deleted_at is null`,
      sql`
        select id, name from admin.employee
        where status = 'ACTIVE' and deleted_at is null
        order by name`,
      sql`
        select id, "firstName", "lastName" from public."Application"
        where status <> 'ERASED'
        order by "createdAt" desc
        limit 50`,
      sql`
        select id, name from public."Company"
        order by "createdAt" desc
        limit 50`,
    ]);

  const total = kpi.total as number;
  const pct = (n: number) =>
    total > 0 ? `${Math.round((n / total) * 100)} %` : "—";

  const tableRows: DataTableRow[] = rows.map((c) => {
    const channel = CHANNEL_META[c.channel as string] ?? CHANNEL_META.SONSTIGE;
    const entityType = c.entity_type as EntityType | null;
    return {
      id: c.id as string,
      cells: {
        channel: (
          <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {channel.icon}
            </span>
            {channel.label}
          </span>
        ),
        direction:
          c.direction === "INBOUND" ? (
            <span className="inline-flex items-center gap-1 text-sm text-info whitespace-nowrap">
              <ArrowDownLeft className="size-3.5" />
              Eingehend
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
              <ArrowUpRight className="size-3.5" />
              Ausgehend
            </span>
          ),
        subject: (
          <div className="min-w-0 max-w-md">
            {c.subject ? (
              <p className="truncate font-medium">{c.subject as string}</p>
            ) : null}
            {c.body ? (
              <p className="truncate text-xs text-muted-foreground">
                {c.body as string}
              </p>
            ) : null}
            {!c.subject && !c.body ? (
              <span className="text-muted-foreground">—</span>
            ) : null}
          </div>
        ),
        entity:
          entityType && c.entity_id ? (
            <Link
              href={entityHref(entityType, c.entity_id as string)}
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-accent">
                {ENTITY_LABELS[entityType] ?? entityType}
              </Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        employee: c.employee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={c.employee_name as string}
              color={c.employee_color as string}
              size="sm"
            />
            <span className="text-sm">{c.employee_name as string}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
        occurred: (
          <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
            {formatDateTime(c.occurred_at as Date)}
          </span>
        ),
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Kommunikation"
        description="Alle Kontaktpunkte mit Kandidaten und Unternehmen an einem Ort."
        actions={
          <CommunicationLogDialog
            candidates={candidates.map((c) => ({
              id: c.id as string,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            companies={companies.map((c) => ({
              id: c.id as string,
              label: c.name as string,
            }))}
            initialOpen={initialOpen}
          />
        }
      />

      <Alert className="mb-5 border-info/30 bg-info-soft text-info">
        <Info className="size-4" />
        <AlertDescription className="text-info/90">
          E-Mail-Versand &amp; WhatsApp-Integration folgen — aktuell manuelle
          Protokollierung.
        </AlertDescription>
      </Alert>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Einträge gesamt" value={total} />
        <KpiCard label="Diese Woche" value={kpi.this_week as number} />
        <KpiCard
          label="E-Mail-Anteil"
          value={pct(kpi.email as number)}
          hint={`${kpi.email} Einträge`}
        />
        <KpiCard
          label="Telefon-Anteil"
          value={pct(kpi.phone as number)}
          hint={`${kpi.phone} Einträge`}
        />
      </div>

      <DataTable
        tableId="kommunikation"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Betreff oder Inhalt durchsuchen…"
        emptyTitle="Noch keine Kommunikation protokolliert"
        emptyDescription="Logge Anrufe, E-Mails und Nachrichten, um die Historie aufzubauen."
        toolbar={
          <>
            <FilterSelect
              param="kanal"
              placeholder="Alle Kanäle"
              options={Object.entries(CHANNEL_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
            />
            <FilterSelect
              param="richtung"
              placeholder="Alle Richtungen"
              options={[
                { value: "OUTBOUND", label: "Ausgehend" },
                { value: "INBOUND", label: "Eingehend" },
              ]}
            />
            <FilterSelect
              param="ma"
              placeholder="Alle Mitarbeiter"
              options={employees.map((e) => ({
                value: e.id as string,
                label: e.name as string,
              }))}
            />
          </>
        }
      />
    </>
  );
}
