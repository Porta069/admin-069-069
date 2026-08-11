import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import {
  entityHref,
  ENTITY_LABELS,
  type EntityType,
} from "@/lib/definitions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { BellOff, ChevronLeft, ChevronRight } from "lucide-react";
import {
  MarkAllReadButton,
  NotificationList,
  type NotificationItem,
} from "./_components/notification-list";

const PAGE_SIZE = 20;

export default async function BenachrichtigungenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("notifications");
  const params = await searchParams;
  const tab = firstParam(params.tab) === "ungelesen" ? "ungelesen" : "alle";
  const page = Math.max(1, Number(firstParam(params.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const unreadOnly = tab === "ungelesen";

  const [rows, countRows] = await Promise.all([
    sql`
      select id, type, title, body, priority, entity_type, entity_id, read_at, created_at
      from admin.notification
      where employee_id = ${employee.id}
        ${unreadOnly ? sql`and read_at is null` : sql``}
      order by created_at desc
      limit ${PAGE_SIZE} offset ${offset}`,
    sql`
      select count(*)::int as total,
             count(*) filter (where read_at is null)::int as unread
      from admin.notification
      where employee_id = ${employee.id}`,
  ]);
  const totals = countRows[0];
  const total = (unreadOnly ? totals.unread : totals.total) as number;
  const unread = totals.unread as number;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id as string,
    type: (r.type as string | null) ?? null,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    priority: (r.priority as string | null) ?? null,
    read: r.read_at !== null,
    createdAt: (r.created_at as Date).toISOString(),
    href:
      r.entity_type && r.entity_id && (r.entity_type as string) in ENTITY_LABELS
        ? entityHref(r.entity_type as EntityType, r.entity_id as string)
        : null,
  }));

  const tabs = [
    { key: "alle", label: "Alle", count: totals.total as number, href: "/benachrichtigungen" },
    { key: "ungelesen", label: "Ungelesen", count: unread, href: "/benachrichtigungen?tab=ungelesen" },
  ];

  const pageHref = (p: number) =>
    `/benachrichtigungen?${new URLSearchParams({
      ...(unreadOnly ? { tab: "ungelesen" } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <>
      <PageHeader
        title="Benachrichtigungen"
        description="Alles, was dich betrifft — Zuweisungen, Fristen und Systemhinweise."
        actions={<MarkAllReadButton disabled={unread === 0} />}
      />

      <div className="mb-4 inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular",
                t.key === "ungelesen" && t.count > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-muted-foreground/10 text-muted-foreground",
              )}
            >
              {formatNumber(t.count)}
            </span>
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={
            unreadOnly
              ? "Keine ungelesenen Benachrichtigungen"
              : "Keine Benachrichtigungen"
          }
          description={
            unreadOnly
              ? "Alles gelesen — gut organisiert."
              : "Sobald dir etwas zugewiesen wird oder Fristen anstehen, erscheint es hier."
          }
        />
      ) : (
        <div className="space-y-3">
          <NotificationList items={items} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="tabular">
              {`${offset + 1}–${Math.min(page * PAGE_SIZE, total)} von ${formatNumber(total)}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 bg-card"
                disabled={page <= 1}
                asChild={page > 1}
                aria-label="Vorherige Seite"
              >
                {page > 1 ? (
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft className="size-4" />
                  </Link>
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>
              <span className="px-2 tabular">
                {page} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8 bg-card"
                disabled={page >= pageCount}
                asChild={page < pageCount}
                aria-label="Nächste Seite"
              >
                {page < pageCount ? (
                  <Link href={pageHref(page + 1)}>
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
