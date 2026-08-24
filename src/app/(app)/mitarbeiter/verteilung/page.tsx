import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { ArrowLeft } from "lucide-react";
import { assignCandidate } from "../../kandidaten/actions";
import { assignCompany } from "../../unternehmen/actions";
import {
  VerteilungBoard,
  type BoardCard,
  type BoardColumn,
} from "./_components/verteilung-board";

export const metadata = { title: "Zuständigkeitsverteilung" };

const ANSICHTEN = [
  { key: "nutzer", label: "Nutzer" },
  { key: "unternehmen", label: "Unternehmen" },
] as const;

export default async function VerteilungPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("employees");
  const params = await searchParams;
  const ansicht = firstParam(params.ansicht) === "unternehmen" ? "unternehmen" : "nutzer";

  const employees = await sql`
    select id, name, avatar_color, avatar_url, presence, last_seen_at
    from admin.employee
    where deleted_at is null and status = 'ACTIVE'
    order by name`;

  const columns: BoardColumn[] = [
    ...employees.map((e) => ({
      employeeId: e.id as string,
      name: e.name as string,
      avatarColor: (e.avatar_color as string | null) ?? null,
      avatarUrl: (e.avatar_url as string | null) ?? null,
      presence: (e.presence as string | null) ?? null,
      lastSeenAt: e.last_seen_at ? (e.last_seen_at as Date).toISOString() : null,
    })),
    { employeeId: null, name: "Ohne Zuständigen", avatarColor: null, avatarUrl: null, presence: null, lastSeenAt: null },
  ];

  let cards: BoardCard[] = [];

  if (ansicht === "nutzer") {
    const rows = await sql`
      select a.id, a."firstName", a."lastName", a.profession,
             cm.assignee_id, cm.status as pipeline_status
      from admin.candidate a
      left join admin.candidate_meta cm on cm.application_id = a.id
      where a.status <> 'ERASED'
        and (cm.assignee_id is not null
             or (cm.status is not null
                 and cm.status not in ('ANGENOMMEN', 'ABGELEHNT', 'KEIN_INTERESSE', 'INAKTIV')))
      order by a."createdAt" desc
      limit 600`;
    cards = rows.map((r) => ({
      id: r.id as string,
      name: `${(r.firstName as string) ?? ""} ${(r.lastName as string) ?? ""}`.trim() || "Kandidat",
      subtitle: (r.profession as string | null) ?? null,
      status: (r.pipeline_status as string | null) ?? "NEU",
      assigneeId: (r.assignee_id as string | null) ?? null,
    }));
  } else {
    const rows = await sql`
      select c.id, c.name, c.ort, co.assignee_id
      from public."Company" c
      left join admin.company_meta co on co.company_id = c.id
      where co.assignee_id is not null
         or exists (select 1 from public."JobPosting" j
                    where j."companyId" = c.id and j.status = 'ACTIVE')
      order by c.name
      limit 600`;
    cards = rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "Unternehmen",
      subtitle: (r.ort as string | null) ?? null,
      status: null,
      assigneeId: (r.assignee_id as string | null) ?? null,
    }));
  }

  return (
    <>
      <Link
        href="/mitarbeiter"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Alle Mitarbeiter
      </Link>
      <PageHeader
        title="Zuständigkeitsverteilung"
        description="Wer betreut wen? Ziehe Nutzer oder Unternehmen zwischen Mitarbeitern — oder nutze das Verschieben-Menü. Änderungen wirken sofort."
      />

      <div className="mb-4 inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        {ANSICHTEN.map((a) => (
          <Link
            key={a.key}
            href={`/mitarbeiter/verteilung?ansicht=${a.key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              ansicht === a.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </Link>
        ))}
      </div>

      <VerteilungBoard
        columns={columns}
        initialCards={cards}
        moveAction={ansicht === "nutzer" ? assignCandidate : assignCompany}
        hrefBase={ansicht === "nutzer" ? "/kandidaten/" : "/unternehmen/"}
        entityLabel={ansicht === "nutzer" ? "Kandidaten" : "Unternehmen"}
      />
    </>
  );
}
