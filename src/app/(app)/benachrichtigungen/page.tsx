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
  AcknowledgeAllButton,
  NotificationList,
  type NotificationItem,
} from "./_components/notification-list";
import { NeueMitteilungDialog } from "./_components/neue-mitteilung-dialog";

const PAGE_SIZE = 20;

const KATEGORIEN = [
  { key: "EREIGNIS", label: "Benachrichtigungen" },
  { key: "SYSTEM", label: "System" },
  { key: "PERSOENLICH", label: "Persönlich" },
] as const;

type KatKey = (typeof KATEGORIEN)[number]["key"];

export default async function BenachrichtigungenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("notifications");
  const params = await searchParams;
  const katParam = firstParam(params.kat);
  const kat: KatKey = KATEGORIEN.some((k) => k.key === katParam)
    ? (katParam as KatKey)
    : "EREIGNIS";
  const page = Math.max(1, Number(firstParam(params.page)) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, countRows, employees] = await Promise.all([
    sql`
      select n.id, n.type, n.kategorie, n.title, n.body, n.priority,
             n.entity_type, n.entity_id, n.created_at,
             e.name as sender_name
      from admin.notification n
      left join admin.employee e on e.id = n.sender_employee_id
      where n.employee_id = ${employee.id}
        and n.acknowledged_at is null
        and n.kategorie = ${kat}
      order by n.created_at desc
      limit ${PAGE_SIZE} offset ${offset}`,
    sql`
      select kategorie, count(*)::int as offen
      from admin.notification
      where employee_id = ${employee.id} and acknowledged_at is null
      group by kategorie`,
    sql`
      select id, name from admin.employee
      where deleted_at is null and status = 'ACTIVE' and id <> ${employee.id}
      order by name`,
  ]);

  // Tags der sichtbaren Mitteilungen auflösen (Namen der getaggten Entitäten).
  const tagMap = new Map<string, { label: string; href: string | null; entityType: string }[]>();
  const notifIds = rows.map((r) => r.id as string);
  if (notifIds.length > 0) {
    const tagRows = await sql`
      select nt.notification_id, nt.entity_type, nt.entity_id,
             coalesce(
               (select trim(("firstName" || ' ' || "lastName")) from admin.candidate
                where id = nt.entity_id and nt.entity_type = 'candidate'),
               (select name from public."Company"
                where id = nt.entity_id and nt.entity_type = 'company')
             ) as label
      from admin.notification_tag nt
      where nt.notification_id = any(${notifIds})`;
    for (const t of tagRows) {
      const nid = t.notification_id as string;
      const arr = tagMap.get(nid) ?? [];
      const et = t.entity_type as string;
      arr.push({
        label: (t.label as string | null) ?? (et === "candidate" ? "Kandidat" : "Unternehmen"),
        href:
          et === "candidate"
            ? `/kandidaten/${t.entity_id}`
            : et === "company"
              ? `/unternehmen/${t.entity_id}`
              : null,
        entityType: et,
      });
      tagMap.set(nid, arr);
    }
  }

  const offenProKat = new Map<string, number>();
  for (const r of countRows) offenProKat.set(r.kategorie as string, r.offen as number);
  const total = offenProKat.get(kat) ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id as string,
    type: (r.type as string | null) ?? null,
    kategorie: r.kategorie as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    priority: (r.priority as string | null) ?? null,
    sender: (r.sender_name as string | null) ?? null,
    createdAt: (r.created_at as Date).toISOString(),
    href:
      r.type === "NEW_CANDIDATE" && r.entity_id
        ? `/kandidaten/${r.entity_id}?tab=matching`
        : r.entity_type && r.entity_id && (r.entity_type as string) in ENTITY_LABELS
          ? entityHref(r.entity_type as EntityType, r.entity_id as string)
          : null,
    tags: tagMap.get(r.id as string),
  }));

  const pageHref = (p: number) =>
    `/benachrichtigungen?${new URLSearchParams({
      kat,
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <>
      <PageHeader
        title="Mitteilungszentrale"
        description="System, Ereignisse und persönliche Mitteilungen — jede bleibt, bis du sie wahrnimmst."
        actions={
          <div className="flex items-center gap-2">
            <NeueMitteilungDialog
              employees={employees.map((e) => ({ id: e.id as string, name: e.name as string }))}
            />
            <AcknowledgeAllButton kategorie={kat} disabled={total === 0} />
          </div>
        }
      />

      <div className="mb-4 inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {KATEGORIEN.map((k) => {
          const count = offenProKat.get(k.key) ?? 0;
          return (
            <Link
              key={k.key}
              href={`/benachrichtigungen?kat=${k.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                kat === k.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular",
                  count > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/10 text-muted-foreground",
                )}
              >
                {formatNumber(count)}
              </span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nichts Offenes"
          description="Sobald hier etwas eintrifft, bleibt es sichtbar, bis du es wahrnimmst."
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
