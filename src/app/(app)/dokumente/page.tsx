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
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { Award, FileText, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { DocumentActions } from "./_components/document-actions";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  CV: { label: "Lebenslauf", icon: <FileText className="size-3.5" /> },
  QUALIFICATION: {
    label: "Qualifikation",
    icon: <Award className="size-3.5" />,
  },
  PHOTO: { label: "Foto", icon: <ImageIcon className="size-3.5" /> },
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString("de-DE", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function shortMime(mime: string | null): string {
  if (!mime) return "—";
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/heic": "HEIC",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
  };
  return map[mime] ?? (mime.split("/")[1] ?? mime).toUpperCase().slice(0, 8);
}

const COLUMNS: DataTableColumn[] = [
  { key: "type", label: "Typ" },
  { key: "name", label: "Dateiname" },
  { key: "candidate", label: "Kandidat" },
  { key: "size", label: "Größe", sortable: true },
  { key: "format", label: "Format" },
  { key: "created", label: "Hochgeladen", sortable: true },
  { key: "actions", label: "", className: "w-30 text-right" },
];

export default async function DokumentePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("documents");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, {
    sort: "created",
  });
  const typ = firstParam(params.typ);

  const orderBy = safeSort(
    sort,
    { created: `d."createdAt"`, size: `d."sizeBytes"` },
    `d."createdAt"`,
  );
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const where = sql`
    (a.id is null or a.status <> 'ERASED')
    ${
      q
        ? sql`and (d."originalName" ilike ${like}
            or (a."firstName" || ' ' || a."lastName") ilike ${like})`
        : sql``
    }
    ${typ ? sql`and d.type = ${typ}` : sql``}`;

  const [rows, [{ count }], [kpi]] = await Promise.all([
    sql`
      select d.id, d.type, d."originalName", d."mimeType", d."sizeBytes", d."createdAt",
             a.id as candidate_id, a."firstName", a."lastName"
      from public."Document" d
      left join public."Application" a on a.id = d."applicationId"
      where ${where}
      order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
      limit ${pageSize} offset ${offset}`,
    sql`
      select count(*)::int as count
      from public."Document" d
      left join public."Application" a on a.id = d."applicationId"
      where ${where}`,
    sql`
      select
        count(*)::int as total,
        count(*) filter (where d.type = 'CV')::int as cv,
        count(*) filter (where d.type = 'QUALIFICATION')::int as qualification,
        count(*) filter (where d.type = 'PHOTO')::int as photo
      from public."Document" d
      left join public."Application" a on a.id = d."applicationId"
      where a.id is null or a.status <> 'ERASED'`,
  ]);

  const tableRows: DataTableRow[] = rows.map((d) => {
    const meta = TYPE_META[d.type as string];
    return {
      id: d.id as string,
      cells: {
        type: meta ? (
          <Badge variant="outline" className="gap-1.5">
            {meta.icon}
            {meta.label}
          </Badge>
        ) : (
          <Badge variant="outline">{d.type as string}</Badge>
        ),
        name: (
          <span className="block max-w-xs truncate font-medium">
            {d.originalName as string}
          </span>
        ),
        candidate: d.candidate_id ? (
          <Link
            href={`/kandidaten/${d.candidate_id as string}`}
            className="text-sm hover:text-primary hover:underline"
          >
            {d.firstName as string} {d.lastName as string}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
        size: (
          <span className="text-sm tabular whitespace-nowrap">
            {formatBytes(d.sizeBytes as number)}
          </span>
        ),
        format: (
          <span className="font-mono text-xs text-muted-foreground">
            {shortMime(d.mimeType as string)}
          </span>
        ),
        created: (
          <span className="text-sm text-muted-foreground tabular whitespace-nowrap">
            {formatDateTime(d.createdAt as Date)}
          </span>
        ),
        actions: (
          <DocumentActions
            id={d.id as string}
            name={(d.originalName as string) ?? "Dokument"}
            mimeType={(d.mimeType as string | null) ?? null}
          />
        ),
      },
    };
  });

  return (
    <>
      <PageHeader
        title="Dokumente"
        description="Von Kandidaten hochgeladene Unterlagen der Plattform."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Dokumente gesamt" value={kpi.total as number} />
        <KpiCard label="Lebensläufe" value={kpi.cv as number} />
        <KpiCard label="Qualifikationen" value={kpi.qualification as number} />
        <KpiCard label="Fotos" value={kpi.photo as number} />
      </div>

      <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        Links sind 5 Minuten gültig und werden auditiert.
      </p>

      <DataTable
        tableId="dokumente"
        columns={COLUMNS}
        rows={tableRows}
        total={count as number}
        page={page}
        pageSize={pageSize}
        searchPlaceholder="Dateiname oder Kandidat suchen…"
        emptyTitle="Keine Dokumente gefunden"
        emptyDescription="Sobald Kandidaten Unterlagen hochladen, erscheinen sie hier."
        toolbar={
          <FilterSelect
            param="typ"
            placeholder="Alle Typen"
            options={Object.entries(TYPE_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
          />
        }
      />
    </>
  );
}
