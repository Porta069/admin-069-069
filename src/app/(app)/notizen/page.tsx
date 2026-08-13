import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { formatRelative } from "@/lib/format";
import {
  ENTITY_LABELS,
  entityHref,
  type EntityType,
} from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { FilterSelect } from "@/components/data-table/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pin, StickyNote } from "lucide-react";
import { NoteCreateDialog } from "./_components/note-dialog";
import { NoteCardActions } from "./_components/note-card-actions";
import { NoteSearch } from "./_components/note-search";

const PAGE_SIZE = 24;

const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function categoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export default async function NotizenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("notes");
  const params = await searchParams;
  const page = Math.max(1, Number(firstParam(params.page)) || 1);
  const q = (firstParam(params.q) ?? "").trim().slice(0, 200);
  const kategorie = firstParam(params.kategorie);
  const autor = firstParam(params.autor);
  const typ = firstParam(params.typ);
  const initialOpen = firstParam(params.neu) === "1";

  const like = `%${q}%`;
  const offset = (page - 1) * PAGE_SIZE;

  const where = sql`
    n.deleted_at is null
    ${q ? sql`and n.content ilike ${like}` : sql``}
    ${kategorie ? sql`and n.category = ${kategorie}` : sql``}
    ${autor ? sql`and n.author_id = ${autor}` : sql``}
    ${typ ? sql`and n.entity_type = ${typ}` : sql``}`;

  const [notes, [{ count }], settingRows, employees, candidates, companies] =
    await Promise.all([
      sql`
        select n.*, e.name as author_name, e.avatar_color as author_color
        from admin.note n
        left join admin.employee e on e.id = n.author_id
        where ${where}
        order by n.pinned desc, n.created_at desc
        limit ${PAGE_SIZE} offset ${offset}`,
      sql`select count(*)::int as count from admin.note n where ${where}`,
      sql`select value from admin.setting where key = 'note_categories'`,
      sql`
        select id, name from admin.employee
        where status = 'ACTIVE' and deleted_at is null
        order by name`,
      sql`
        select id, "firstName", "lastName" from admin.candidate
        where status <> 'ERASED'
        order by "createdAt" desc
        limit 50`,
      sql`
        select id, name from public."Company"
        order by "createdAt" desc
        limit 50`,
    ]);

  const categories: string[] = Array.isArray(settingRows[0]?.value)
    ? (settingRows[0].value as string[])
    : ["ALLGEMEIN"];
  const canManage = can(employee, "notes", "manage");
  const canEdit = can(employee, "notes", "edit");
  const canDelete = can(employee, "notes", "delete");
  const pageCount = Math.max(1, Math.ceil((count as number) / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (kategorie) sp.set("kategorie", kategorie);
    if (autor) sp.set("autor", autor);
    if (typ) sp.set("typ", typ);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/notizen?${s}` : "/notizen";
  };

  return (
    <>
      <PageHeader
        title="Notizen"
        description="Team-Wissen sammeln, pinnen und mit Datensätzen verknüpfen."
        actions={
          <NoteCreateDialog
            categories={categories}
            candidates={candidates.map((c) => ({
              id: c.id as string,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            companies={companies.map((c) => ({
              id: c.id as string,
              label: c.name as string,
            }))}
            canManage={canManage}
            initialOpen={initialOpen}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NoteSearch />
        <FilterSelect
          param="kategorie"
          placeholder="Alle Kategorien"
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          param="autor"
          placeholder="Alle Autoren"
          options={employees.map((e) => ({
            value: e.id as string,
            label: e.name as string,
          }))}
        />
        <FilterSelect
          param="typ"
          placeholder="Alle Verknüpfungen"
          options={[
            { value: "candidate", label: "Kandidat" },
            { value: "company", label: "Unternehmen" },
          ]}
        />
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Keine Notizen gefunden"
          description={
            q || kategorie || autor || typ
              ? "Keine Treffer für die aktuellen Filter — Filter zurücksetzen und erneut versuchen."
              : "Erstelle die erste Notiz, um Team-Wissen festzuhalten."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => {
            const entityType = n.entity_type as EntityType | null;
            const category = (n.category as string) ?? "ALLGEMEIN";
            return (
              <article
                key={n.id as string}
                className="flex flex-col rounded-lg border bg-card p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 font-medium"
                    style={{ color: categoryColor(category) }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: categoryColor(category) }}
                    />
                    {category}
                  </Badge>
                  {Boolean(n.pinned) && (
                    <Pin className="size-3.5 text-primary" aria-label="Angepinnt" />
                  )}
                  <div className="ml-auto">
                    <NoteCardActions
                      noteId={n.id as string}
                      content={n.content as string}
                      category={category}
                      pinned={Boolean(n.pinned)}
                      categories={categories}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  </div>
                </div>
                <p className="line-clamp-4 flex-1 text-sm whitespace-pre-wrap">
                  {n.content as string}
                </p>
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                  <EmployeeAvatar
                    name={n.author_name as string}
                    color={n.author_color as string}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    {(n.author_name as string) ?? "Unbekannt"} ·{" "}
                    {formatRelative(n.created_at as Date)}
                  </span>
                  {entityType && n.entity_id && (
                    <Link
                      href={entityHref(entityType, n.entity_id as string)}
                      className="ml-auto inline-flex"
                    >
                      <Badge variant="outline" className="hover:bg-accent">
                        {ENTITY_LABELS[entityType] ?? entityType}
                      </Badge>
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular">
            Seite {page} von {pageCount} · {count as number} Notizen
          </span>
          <div className="flex items-center gap-1">
            <Button
              asChild={page > 1}
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={page <= 1}
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)}>
                  <ChevronLeft className="size-4" />
                  Zurück
                </Link>
              ) : (
                <span className="inline-flex items-center">
                  <ChevronLeft className="size-4" />
                  Zurück
                </span>
              )}
            </Button>
            <Button
              asChild={page < pageCount}
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={page >= pageCount}
            >
              {page < pageCount ? (
                <Link href={pageHref(page + 1)}>
                  Weiter
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span className="inline-flex items-center">
                  Weiter
                  <ChevronRight className="size-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
