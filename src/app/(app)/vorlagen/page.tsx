import * as React from "react";
import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { FileStack, KeyRound, ArrowUpRight } from "lucide-react";
import {
  TemplateDialog,
  TEMPLATE_TYPE_LABELS,
} from "./_components/template-dialog";
import { TemplateCardActions } from "./_components/template-card-actions";
import { FilterSelect } from "@/components/data-table/filter-select";

/** Highlight {variable} placeholders inside a template text. */
function highlightVariables(text: string): React.ReactNode[] {
  return text.split(/(\{[a-z_]+\})/g).map((part, i) =>
    /^\{[a-z_]+\}$/.test(part) ? (
      <span key={i} className="font-mono text-[0.95em] font-medium text-primary">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export default async function VorlagenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("templates");
  const params = await searchParams;
  const typ = firstParam(params.typ);
  const initialOpen = firstParam(params.neu) === "1";

  const templates = await sql`
    select id, name, type, subject, body, updated_at
    from admin.template
    where deleted_at is null
      ${typ ? sql`and type = ${typ}` : sql``}
    order by updated_at desc
    limit 200`;

  const canCreate = can(employee, "templates", "create");
  const canEdit = can(employee, "templates", "edit");
  const canDelete = can(employee, "templates", "delete");

  return (
    <>
      <PageHeader
        title="Vorlagen"
        description="Textbausteine für E-Mails, Nachrichten und Antworten."
        actions={canCreate ? <TemplateDialog initialOpen={initialOpen} /> : null}
      />

      <Link
        href="/vorlagen/passwort-reset"
        className="group mb-4 flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <KeyRound className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Passwort-Reset-E-Mail (Porta Jobs)</span>
          <span className="block text-xs text-muted-foreground">
            Voll editierbares E-Mail-Design — jedes Feld & Logo, mit Live-Vorschau und Standard-Wiederherstellung.
          </span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>

      <div className="mb-4">
        <FilterSelect
          param="typ"
          placeholder="Alle Typen"
          options={Object.entries(TEMPLATE_TYPE_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Noch keine Vorlagen"
          description="Erstelle die erste Vorlage, um wiederkehrende Texte zu standardisieren."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <article
              key={t.id as string}
              className="flex flex-col rounded-lg border bg-card p-4"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-semibold">
                    {t.name as string}
                  </h3>
                  <Badge variant="outline" className="mt-1.5">
                    {TEMPLATE_TYPE_LABELS[t.type as string] ??
                      (t.type as string)}
                  </Badge>
                </div>
                <TemplateCardActions
                  template={{
                    id: t.id as string,
                    name: t.name as string,
                    type: t.type as string,
                    subject: (t.subject as string) ?? null,
                    body: t.body as string,
                  }}
                  canEdit={canEdit}
                  canCreate={canCreate}
                  canDelete={canDelete}
                />
              </div>
              {t.subject ? (
                <p className="truncate text-sm font-medium">
                  {highlightVariables(t.subject as string)}
                </p>
              ) : null}
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">
                {highlightVariables(t.body as string)}
              </p>
              <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
                Bearbeitet {formatRelative(t.updated_at as Date)}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
