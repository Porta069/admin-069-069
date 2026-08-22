import crypto from "crypto";
import Link from "next/link";
import { cookies } from "next/headers";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  firstParam,
  readTableParams,
  type SearchParams,
} from "@/lib/table-params";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  ENTITY_LABELS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { KpiCard } from "@/components/common/kpi-card";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { CircleCheck, CircleX } from "lucide-react";
import { DateRangeFilter } from "./_components/date-range-filter";
import { RevokeSessionButton } from "./_components/revoke-session-button";

const TABS = [
  { key: "feed", label: "Aktivitäts-Feed" },
  { key: "log", label: "Audit-Log" },
  { key: "plattform", label: "Plattform-Audit" },
  { key: "logins", label: "Anmeldungen" },
  { key: "sessions", label: "Aktive Sessions" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readDateRange(params: SearchParams) {
  const von = firstParam(params.von);
  const bis = firstParam(params.bis);
  return {
    von: von && DATE_RE.test(von) ? von : undefined,
    bis: bis && DATE_RE.test(bis) ? bis : undefined,
  };
}

function actionBadge(action: string) {
  return (
    <Badge variant="secondary" className="font-mono text-[11px] font-normal">
      {action}
    </Badge>
  );
}

function metadataCell(metadata: unknown) {
  const json =
    metadata && Object.keys(metadata as object).length > 0
      ? JSON.stringify(metadata)
      : null;
  if (!json) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className="block max-w-56 truncate font-mono text-xs text-muted-foreground"
      title={json}
    >
      {json}
    </span>
  );
}

function objectCell(entityType: string | null, entityId: string | null) {
  if (!entityType) return <span className="text-muted-foreground">—</span>;
  const label =
    ENTITY_LABELS[entityType as EntityType] ?? entityType;
  if (entityId && entityType in ENTITY_LABELS) {
    return (
      <Link
        href={entityHref(entityType as EntityType, entityId)}
        className="text-sm font-medium hover:text-primary hover:underline"
      >
        {label}
      </Link>
    );
  }
  return <span className="text-sm">{label}</span>;
}

function TabNav({ active }: { active: TabKey }) {
  return (
    <div className="mb-4 inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "log" ? "/audit" : `/audit?tab=${tab.key}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

/* ---------- Tab a: Admin-Audit-Log ---------- */

async function AdminAuditTab({ params }: { params: SearchParams }) {
  const { page, pageSize, q } = readTableParams(params, { sort: "createdAt" });
  const aktion = firstParam(params.aktion);
  const actor = firstParam(params.mitarbeiter);
  const objekt = firstParam(params.objekt);
  const { von, bis } = readDateRange(params);
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    where true
      ${q ? sql`and (a.action ilike ${like} or e.name ilike ${like})` : sql``}
      ${aktion ? sql`and a.action = ${aktion}` : sql``}
      ${actor ? sql`and a.actor_id = ${actor}` : sql``}
      ${objekt ? sql`and a.entity_type = ${objekt}` : sql``}
      ${von ? sql`and a.created_at >= ${von}::date` : sql``}
      ${bis ? sql`and a.created_at < (${bis}::date + interval '1 day')` : sql``}`;

  const [rows, countRows, actionsList, employees, entityTypes] =
    await Promise.all([
      sql`
        select a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
               e.name as actor_name, e.avatar_color
        from admin.audit_log a
        left join admin.employee e on e.id = a.actor_id
        ${where}
        order by a.created_at desc
        limit ${pageSize} offset ${offset}`,
      sql`
        select count(*)::int as count
        from admin.audit_log a
        left join admin.employee e on e.id = a.actor_id
        ${where}`,
      sql`select distinct action from admin.audit_log order by action limit 200`,
      sql`select id, name from admin.employee where deleted_at is null order by name`,
      sql`select distinct entity_type from admin.audit_log where entity_type is not null order by entity_type limit 50`,
    ]);

  const columns: DataTableColumn[] = [
    { key: "zeit", label: "Zeitpunkt" },
    { key: "mitarbeiter", label: "Mitarbeiter" },
    { key: "aktion", label: "Aktion" },
    { key: "objekt", label: "Objekt" },
    { key: "details", label: "Details" },
  ];

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    cells: {
      zeit: (
        <span className="whitespace-nowrap text-muted-foreground tabular">
          {formatDateTime(r.created_at as Date)}
        </span>
      ),
      mitarbeiter: r.actor_name ? (
        <span className="flex items-center gap-2">
          <EmployeeAvatar
            name={r.actor_name as string}
            color={r.avatar_color as string}
            size="sm"
          />
          <span className="truncate font-medium">{r.actor_name as string}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">System</span>
      ),
      aktion: actionBadge(r.action as string),
      objekt: objectCell(
        r.entity_type as string | null,
        r.entity_id as string | null,
      ),
      details: metadataCell(r.metadata),
    },
  }));

  return (
    <DataTable
      tableId="audit-log"
      columns={columns}
      rows={tableRows}
      total={countRows[0].count as number}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Aktion oder Mitarbeiter suchen…"
      emptyTitle="Keine Audit-Einträge"
      emptyDescription="Sobald im Admin gearbeitet wird, erscheinen hier alle Änderungen."
      toolbar={
        <>
          <FilterSelect
            param="aktion"
            placeholder="Alle Aktionen"
            options={actionsList.map((a) => ({
              value: a.action as string,
              label: a.action as string,
            }))}
          />
          <FilterSelect
            param="mitarbeiter"
            placeholder="Alle Mitarbeiter"
            options={employees.map((e) => ({
              value: e.id as string,
              label: e.name as string,
            }))}
          />
          <FilterSelect
            param="objekt"
            placeholder="Alle Objekttypen"
            options={entityTypes.map((t) => ({
              value: t.entity_type as string,
              label:
                ENTITY_LABELS[t.entity_type as EntityType] ??
                (t.entity_type as string),
            }))}
          />
          <DateRangeFilter />
        </>
      }
    />
  );
}

/* ---------- Tab b: Plattform-Audit (public."AuditEvent", read-only) ---------- */

async function PlatformAuditTab({ params }: { params: SearchParams }) {
  const { page, pageSize, q } = readTableParams(params, { sort: "createdAt" });
  const aktion = firstParam(params.aktion);
  const objekt = firstParam(params.objekt);
  const { von, bis } = readDateRange(params);
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    where true
      ${q ? sql`and a.action ilike ${like}` : sql``}
      ${aktion ? sql`and a.action = ${aktion}` : sql``}
      ${objekt ? sql`and a."entityType" = ${objekt}` : sql``}
      ${von ? sql`and a."createdAt" >= ${von}::date` : sql``}
      ${bis ? sql`and a."createdAt" < (${bis}::date + interval '1 day')` : sql``}`;

  const [rows, countRows, actionsList, entityTypes] = await Promise.all([
    sql`
      select a.id, a.action, a."entityType", a."entityId", a.metadata, a."createdAt"
      from public."AuditEvent" a
      ${where}
      order by a."createdAt" desc
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int as count from public."AuditEvent" a ${where}`,
    sql`select distinct action from public."AuditEvent" order by action limit 200`,
    sql`select distinct "entityType" from public."AuditEvent" where "entityType" is not null order by "entityType" limit 50`,
  ]);

  const columns: DataTableColumn[] = [
    { key: "zeit", label: "Zeitpunkt" },
    { key: "aktion", label: "Aktion" },
    { key: "objekt", label: "Objekt" },
    { key: "objektId", label: "Objekt-ID", defaultHidden: true },
    { key: "details", label: "Details" },
  ];

  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id as string,
    cells: {
      zeit: (
        <span className="whitespace-nowrap text-muted-foreground tabular">
          {formatDateTime(r.createdAt as Date)}
        </span>
      ),
      aktion: actionBadge(r.action as string),
      objekt: objectCell(
        r.entityType as string | null,
        r.entityId as string | null,
      ),
      objektId: r.entityId ? (
        <span className="font-mono text-xs text-muted-foreground">
          {r.entityId as string}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      details: metadataCell(r.metadata),
    },
  }));

  return (
    <DataTable
      tableId="audit-plattform"
      columns={columns}
      rows={tableRows}
      total={countRows[0].count as number}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Aktion suchen…"
      emptyTitle="Keine Plattform-Events"
      emptyDescription="Backend-Ereignisse der Plattform erscheinen hier automatisch."
      toolbar={
        <>
          <FilterSelect
            param="aktion"
            placeholder="Alle Aktionen"
            options={actionsList.map((a) => ({
              value: a.action as string,
              label: a.action as string,
            }))}
          />
          <FilterSelect
            param="objekt"
            placeholder="Alle Objekttypen"
            options={entityTypes.map((t) => ({
              value: t.entityType as string,
              label:
                ENTITY_LABELS[t.entityType as EntityType] ??
                (t.entityType as string),
            }))}
          />
          <DateRangeFilter />
        </>
      }
    />
  );
}

/* ---------- Tab c: Anmeldungen ---------- */

async function LoginsTab({ params }: { params: SearchParams }) {
  const { page, pageSize, q } = readTableParams(params, { sort: "createdAt" });
  const erfolg = firstParam(params.erfolg);
  const { von, bis } = readDateRange(params);
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    where true
      ${q ? sql`and l.email ilike ${like}` : sql``}
      ${erfolg === "ok" ? sql`and l.success = true` : sql``}
      ${erfolg === "fehl" ? sql`and l.success = false` : sql``}
      ${von ? sql`and l.created_at >= ${von}::date` : sql``}
      ${bis ? sql`and l.created_at < (${bis}::date + interval '1 day')` : sql``}`;

  const [rows, countRows, kpiRows] = await Promise.all([
    sql`
      select l.id, l.email, l.success, l.ip, l.user_agent, l.created_at
      from admin.login_event l
      ${where}
      order by l.created_at desc
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int as count from admin.login_event l ${where}`,
    sql`
      select count(*) filter (where success)::int as ok,
             count(*) filter (where not success)::int as failed
      from admin.login_event
      where created_at > now() - interval '7 days'`,
  ]);
  const kpi = kpiRows[0];

  const columns: DataTableColumn[] = [
    { key: "zeit", label: "Zeitpunkt" },
    { key: "email", label: "E-Mail" },
    { key: "erfolg", label: "Erfolg" },
    { key: "ip", label: "IP" },
    { key: "userAgent", label: "User-Agent" },
  ];

  const tableRows: DataTableRow[] = rows.map((r) => {
    const success = Boolean(r.success);
    return {
      id: r.id as string,
      cells: {
        zeit: (
          <span className="whitespace-nowrap text-muted-foreground tabular">
            {formatDateTime(r.created_at as Date)}
          </span>
        ),
        email: (
          <span className={cn("font-medium", !success && "text-destructive")}>
            {r.email as string}
          </span>
        ),
        erfolg: success ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CircleCheck className="size-4" />
            Erfolgreich
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
            <CircleX className="size-3.5" />
            Fehlgeschlagen
          </span>
        ),
        ip: (
          <span className="font-mono text-xs text-muted-foreground">
            {(r.ip as string | null) ?? "—"}
          </span>
        ),
        userAgent: (
          <span
            className="block max-w-56 truncate text-xs text-muted-foreground"
            title={(r.user_agent as string | null) ?? undefined}
          >
            {(r.user_agent as string | null) ?? "—"}
          </span>
        ),
      },
    };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
        <KpiCard
          label="Logins · 7 Tage"
          value={formatNumber(kpi.ok as number)}
        />
        <KpiCard
          label="Fehlversuche · 7 Tage"
          value={formatNumber(kpi.failed as number)}
          className={
            (kpi.failed as number) > 0
              ? "border-destructive/40 [&_p:nth-child(2)]:text-destructive"
              : undefined
          }
          hint={(kpi.failed as number) > 0 ? "Bitte prüfen" : "Alles ruhig"}
        />
      </div>
      <DataTable
        tableId="audit-logins"
        columns={columns}
        rows={tableRows}
        total={countRows[0].count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="E-Mail suchen…"
        emptyTitle="Keine Anmeldeversuche"
        emptyDescription="Erfolgreiche und fehlgeschlagene Logins werden hier protokolliert."
        toolbar={
          <>
            <FilterSelect
              param="erfolg"
              placeholder="Alle Ergebnisse"
              options={[
                { value: "ok", label: "Erfolgreich" },
                { value: "fehl", label: "Fehlgeschlagen" },
              ]}
            />
            <DateRangeFilter />
          </>
        }
      />
    </div>
  );
}

/* ---------- Tab d: Aktive Sessions ---------- */

async function SessionsTab({ params }: { params: SearchParams }) {
  const { page, pageSize, q } = readTableParams(params, { sort: "createdAt" });
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const cookieStore = await cookies();
  const ownToken = cookieStore.get("pw_session")?.value;
  const ownHash = ownToken
    ? crypto.createHash("sha256").update(ownToken).digest("hex")
    : null;

  const where = sql`
    where s.revoked_at is null and s.expires_at > now()
      ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like})` : sql``}`;

  const [rows, countRows] = await Promise.all([
    sql`
      select s.token_hash, s.ip, s.user_agent, s.created_at, s.expires_at,
             e.id as employee_id, e.name, e.avatar_color
      from admin.session s
      join admin.employee e on e.id = s.employee_id and e.deleted_at is null
      ${where}
      order by s.created_at desc
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from admin.session s
      join admin.employee e on e.id = s.employee_id and e.deleted_at is null
      ${where}`,
  ]);

  const columns: DataTableColumn[] = [
    { key: "mitarbeiter", label: "Mitarbeiter" },
    { key: "erstellt", label: "Erstellt" },
    { key: "ablauf", label: "Läuft ab" },
    { key: "ip", label: "IP" },
    { key: "userAgent", label: "User-Agent" },
    { key: "aktion", label: "", className: "text-right" },
  ];

  const tableRows: DataTableRow[] = rows.map((r) => {
    const isCurrent = ownHash !== null && r.token_hash === ownHash;
    return {
      id: r.token_hash as string,
      cells: {
        mitarbeiter: (
          <span className="flex items-center gap-2">
            <EmployeeAvatar
              name={r.name as string}
              color={r.avatar_color as string}
              size="sm"
            />
            <span className="truncate font-medium">{r.name as string}</span>
            {isCurrent && (
              <Badge className="bg-primary/10 text-primary" variant="secondary">
                Diese Sitzung
              </Badge>
            )}
          </span>
        ),
        erstellt: (
          <span className="whitespace-nowrap text-muted-foreground tabular">
            {formatDateTime(r.created_at as Date)}
          </span>
        ),
        ablauf: (
          <span className="whitespace-nowrap text-muted-foreground tabular">
            {formatDateTime(r.expires_at as Date)}
          </span>
        ),
        ip: (
          <span className="font-mono text-xs text-muted-foreground">
            {(r.ip as string | null) ?? "—"}
          </span>
        ),
        userAgent: (
          <span
            className="block max-w-56 truncate text-xs text-muted-foreground"
            title={(r.user_agent as string | null) ?? undefined}
          >
            {(r.user_agent as string | null) ?? "—"}
          </span>
        ),
        aktion: (
          <span className="flex justify-end">
            {isCurrent ? (
              <span className="text-xs text-muted-foreground/70">—</span>
            ) : (
              <RevokeSessionButton
                tokenHash={r.token_hash as string}
                employeeName={r.name as string}
              />
            )}
          </span>
        ),
      },
    };
  });

  return (
    <DataTable
      tableId="audit-sessions"
      columns={columns}
      rows={tableRows}
      total={countRows[0].count as number}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Mitarbeiter suchen…"
      emptyTitle="Keine aktiven Sitzungen"
      emptyDescription="Derzeit ist niemand außer dir angemeldet — oder die Sitzungen sind abgelaufen."
    />
  );
}

/* ---------- Page ---------- */

/* ── Aktivitäts-Feed: Audit + Kommunikation + Anrufe als eine Zeitleiste ──── */

interface FeedRow {
  art: string;
  ts: Date;
  actor: string | null;
  avatar_color: string | null;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
}

const FEED_ART_LABEL: Record<string, string> = {
  audit: "Änderung",
  comm: "Kommunikation",
  call: "Anruf",
};

async function FeedTab() {
  const rows = (await sql`
    select art, ts, actor, avatar_color, entity_type, entity_id, detail from (
      select 'audit'::text as art, al.created_at as ts, e.name as actor,
             e.avatar_color as avatar_color, al.entity_type, al.entity_id,
             al.action as detail
      from admin.audit_log al
      left join admin.employee e on e.id = al.actor_id
      union all
      select 'comm', k.occurred_at, e.name, e.avatar_color, k.entity_type, k.entity_id,
             nullif(concat_ws(' · ', k.direction, k.channel, k.subject), '')
      from admin.communication k
      left join admin.employee e on e.id = k.employee_id
      where k.deleted_at is null
      union all
      select 'call', cs.created_at, e.name, e.avatar_color, 'candidate', cs.application_id,
             nullif(concat_ws(' · ', 'Anruf', cs.candidate_name, cs.status), '')
      from admin.call_session cs
      left join admin.employee e on e.id = cs.employee_id
      where cs.deleted_at is null
    ) x
    order by ts desc
    limit 60`) as unknown as FeedRow[];

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Noch keine Aktivität.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <ul className="divide-y">
        {rows.map((r, i) => {
          const href =
            r.entity_type && r.entity_id
              ? entityHref(r.entity_type as EntityType, r.entity_id)
              : null;
          const entityLabel =
            r.entity_type && r.entity_type in ENTITY_LABELS
              ? ENTITY_LABELS[r.entity_type as EntityType]
              : r.entity_type;
          return (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <EmployeeAvatar
                name={r.actor ?? "System"}
                color={r.avatar_color ?? "#94a3b8"}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{r.actor ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">{r.detail ?? FEED_ART_LABEL[r.art] ?? r.art}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-normal">
                    {FEED_ART_LABEL[r.art] ?? r.art}
                  </Badge>
                  {href ? (
                    <Link href={href} className="hover:text-foreground hover:underline">
                      {entityLabel}
                    </Link>
                  ) : entityLabel ? (
                    <span>{entityLabel}</span>
                  ) : null}
                  <span className="ml-auto">{formatDateTime(r.ts)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("audit");
  const params = await searchParams;
  const tabParam = firstParam(params.tab);
  const tab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "log";

  return (
    <>
      <PageHeader
        title="Audit & Sicherheit"
        description="Lückenlose Nachvollziehbarkeit: Änderungen, Plattform-Events, Anmeldungen und aktive Sitzungen."
      />
      <TabNav active={tab} />
      {tab === "feed" && <FeedTab />}
      {tab === "log" && <AdminAuditTab params={params} />}
      {tab === "plattform" && <PlatformAuditTab params={params} />}
      {tab === "logins" && <LoginsTab params={params} />}
      {tab === "sessions" && <SessionsTab params={params} />}
    </>
  );
}
