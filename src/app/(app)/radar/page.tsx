import Link from "next/link";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  readTableParams,
  safeSort,
  firstParam,
  type SearchParams,
} from "@/lib/table-params";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Radar } from "lucide-react";
import { RowActions } from "./_components/row-actions";
import { RadarSettingsDialog } from "./_components/settings-dialog";
import { bulkUebernehmen, bulkVerwerfen } from "./actions";
import {
  RICHTUNG_LABELS,
  RICHTUNG_OPTIONS,
  SCORE_MIN_OPTIONS,
  SUGGESTION_STATUS,
  SUGGESTION_STATUS_OPTIONS,
  scoreTone,
} from "./_components/constants";

const columns: DataTableColumn[] = [
  { key: "kandidat", label: "Kandidat" },
  { key: "job", label: "Stelle" },
  { key: "unternehmen", label: "Unternehmen" },
  { key: "score", label: "Match-Score", sortable: true, className: "text-right" },
  { key: "richtung", label: "Richtung" },
  { key: "assignee", label: "Zuständig" },
  { key: "erkannt", label: "Erkannt am", sortable: true },
  { key: "aktionen", label: "", className: "text-right" },
];

function ScoreCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        "font-display text-lg leading-none font-semibold tabular",
        tone === "hoch" && "text-success",
        tone === "mittel" && "text-warning",
        tone === "niedrig" && "text-muted-foreground",
      )}
    >
      {score}
      <span className="text-xs font-normal text-muted-foreground"> %</span>
    </span>
  );
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("matching");
  const canEdit = can(employee, "matching", "edit");
  const canManage = can(employee, "matching", "manage");

  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "score",
  });
  const richtung = firstParam(params.richtung);
  const status = firstParam(params.status);
  const minScoreRaw = firstParam(params.min);
  const minScore = minScoreRaw ? Number(minScoreRaw) : null;

  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  // Sekundär-Sortierung (offene Vorschläge bleiben immer oben).
  const orderCol = safeSort(
    sort,
    { score: `s.match_score`, erkannt: `s.created_at` },
    `s.match_score`,
  );

  const where = sql`
    where 1 = 1
      ${richtung ? sql`and s.richtung = ${richtung}` : sql``}
      ${status ? sql`and s.status = ${status}` : sql``}
      ${minScore !== null && Number.isFinite(minScore) ? sql`and s.match_score >= ${minScore}` : sql``}
      ${
        q
          ? sql`and (
              coalesce(s.candidate_name, '') ilike ${like}
              or coalesce(s.job_title, '') ilike ${like}
              or coalesce(s.company_name, '') ilike ${like}
            )`
          : sql``
      }`;

  const [rows, [{ count }], [stats], settingRows] = await Promise.all([
    sql`
      select s.id, s.application_id, s.candidate_name, s.job_posting_id,
             s.job_title, s.company_id, s.company_name, s.match_score,
             s.richtung, s.status, s.created_at, s.handled_at,
             e.name as assignee_name, e.avatar_color as assignee_color
      from admin.match_suggestion s
      left join admin.employee e on e.id = s.assignee_id
      ${where}
      order by
        case s.status
          when 'NEU' then 0
          when 'GESICHTET' then 1
          when 'VORGESCHLAGEN' then 2
          else 3
        end,
        ${sql.unsafe(orderCol)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql`select count(*)::int as count from admin.match_suggestion s ${where}`,
    sql`
      select
        count(*) filter (where status = 'NEU')::int as neu,
        count(*) filter (where status in ('NEU', 'GESICHTET'))::int as offen,
        avg(match_score) filter (where status in ('NEU', 'GESICHTET'))::float as avg_offen
      from admin.match_suggestion`,
    sql`select value from admin.setting where key = 'radar'`,
  ]);

  const setting = (settingRows[0]?.value ?? {}) as {
    schwelle?: number;
    top_n?: number;
  };
  const schwelle = Number.isFinite(setting.schwelle)
    ? (setting.schwelle as number)
    : 75;
  const topN = Number.isFinite(setting.top_n) ? (setting.top_n as number) : 5;

  const avgOffen =
    stats.avg_offen === null || stats.avg_offen === undefined
      ? null
      : Math.round(stats.avg_offen as number);

  const tableRows: DataTableRow[] = rows.map((r) => {
    const isOpen = r.status === "NEU" || r.status === "GESICHTET";
    return {
      id: r.id as string,
      cells: {
        kandidat: (
          <Link
            href={`/kandidaten/${r.application_id as string}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {(r.candidate_name as string | null) ?? "Unbekannt"}
          </Link>
        ),
        job: (
          <Link
            href={`/stellen/${r.job_posting_id as string}`}
            className="hover:text-primary hover:underline"
          >
            {(r.job_title as string | null) ?? "—"}
          </Link>
        ),
        unternehmen: r.company_id ? (
          <Link
            href={`/unternehmen/${r.company_id as string}`}
            className="text-muted-foreground hover:text-primary hover:underline"
          >
            {(r.company_name as string | null) ?? "—"}
          </Link>
        ) : (
          <span className="text-muted-foreground">
            {(r.company_name as string | null) ?? "—"}
          </span>
        ),
        score: <ScoreCell score={r.match_score as number | null} />,
        richtung: (
          <Badge variant="secondary" className="font-normal">
            {RICHTUNG_LABELS[r.richtung as string] ?? (r.richtung as string)}
          </Badge>
        ),
        assignee: r.assignee_name ? (
          <span className="inline-flex items-center gap-2">
            <EmployeeAvatar
              name={r.assignee_name as string}
              color={r.assignee_color as string}
              size="sm"
            />
            <span className="text-sm">{r.assignee_name as string}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
        erkannt: (
          <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
            {formatRelative(r.created_at as Date)}
          </span>
        ),
        aktionen:
          isOpen && canEdit ? (
            <RowActions id={r.id as string} />
          ) : (
            <StatusBadge
              map={SUGGESTION_STATUS}
              value={r.status as string}
              withDot={false}
            />
          ),
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Matching-Radar"
        description="Automatisch erkannte Top-Matches zwischen Kandidaten und Stellen — zum Sichten, Übernehmen oder Verwerfen."
        actions={canManage ? <RadarSettingsDialog schwelle={schwelle} topN={topN} /> : undefined}
      />

      {/* Erklär-Karte */}
      <div className="mb-5 flex flex-wrap items-start gap-3 rounded-lg border bg-card p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Radar className="size-4.5 text-primary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Das System erkennt neue Top-Matches automatisch — bei jeder neuen
            Stelle und jeder neuen Registrierung.
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Der Sync-Runner legt je Kandidat und Stelle die besten Treffer ab
            einem Score von{" "}
            <span className="font-medium text-foreground tabular">
              {schwelle} %
            </span>{" "}
            an — höchstens{" "}
            <span className="font-medium text-foreground tabular">{topN}</span>{" "}
            pro Lauf. Diese Werte lassen sich über die Einstellungen anpassen.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Neue Vorschläge"
          value={formatNumber(stats.neu as number)}
          accent
          hint="noch nicht gesichtet"
        />
        <KpiCard
          label="Offen gesamt"
          value={formatNumber(stats.offen as number)}
          hint="neu + gesichtet"
        />
        <KpiCard
          label="Ø Score (offen)"
          value={avgOffen === null ? "—" : `${avgOffen} %`}
        />
      </div>

      <DataTable
        tableId="radar"
        columns={columns}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Kandidat, Stelle oder Unternehmen…"
        emptyTitle="Keine Vorschläge gefunden"
        emptyDescription="Sobald der Sync-Runner passende Matches erkennt, erscheinen sie hier automatisch."
        toolbar={
          <>
            <FilterSelect
              param="richtung"
              placeholder="Alle Richtungen"
              options={RICHTUNG_OPTIONS}
            />
            <FilterSelect
              param="status"
              placeholder="Alle Status"
              options={SUGGESTION_STATUS_OPTIONS}
            />
            <FilterSelect
              param="min"
              placeholder="Score-Schwelle"
              options={SCORE_MIN_OPTIONS}
              className="h-9 w-40 bg-card"
            />
          </>
        }
        bulkActions={
          canEdit
            ? [
                { label: "Als Vorschlag übernehmen", action: bulkUebernehmen },
                {
                  label: "Verwerfen",
                  action: bulkVerwerfen,
                  destructive: true,
                },
              ]
            : undefined
        }
      />
    </>
  );
}
