import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { anrufDatenFuer } from "@/lib/matching/anruf";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { AnrufInterface } from "../../kandidaten/[id]/anruf/_components/anruf-interface";
import { ArrowLeft, SkipForward, UserSquare2 } from "lucide-react";

export const metadata = { title: "Anruf · Call Center" };

export default async function CallCenterCallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const employee = await requireEmployee("candidates", "edit");
  const { id } = await params;
  const { task } = await searchParams;
  const taskId = firstParam(task) ?? null;

  const [c] = await sql`
    select c.id, c."firstName", c."lastName", c.email, c.phone, c.profession,
           c."federalState"
    from admin.candidate c
    where c.id = ${id} limit 1`;
  if (!c) notFound();

  // Aktive Mitarbeiter (für die Bearbeiterzuordnung) + aktueller Assignee.
  const [mitarbeiter, taskRow] = await Promise.all([
    sql<{ id: string; name: string; avatar_color: string | null }[]>`
      select id, name, avatar_color from admin.employee
      where deleted_at is null and status = 'ACTIVE'
      order by name asc`,
    taskId
      ? sql<{ assignee_id: string | null }[]>`
          select assignee_id from admin.task
          where id = ${taskId} and deleted_at is null limit 1`
      : Promise.resolve([] as { assignee_id: string | null }[]),
  ]);
  const aktuellerBearbeiterId =
    (taskRow[0]?.assignee_id as string | null) ?? employee.id;
  const bearbeiter = mitarbeiter.map((m) => ({
    id: m.id,
    name: m.name,
    avatarColor: m.avatar_color ?? null,
  }));

  // Nächster offener Anruf in der Warteschlange (für „Weiter"-Sprung).
  const [next] = await sql<{ candidate_id: string; task_id: string }[]>`
    select t.entity_id as candidate_id, t.id as task_id
    from admin.task t
    join admin.candidate c on c.id = t.entity_id
    where t.entity_type = 'candidate' and t.status = 'OPEN'
      and (t.title like 'Neuregistrierung anrufen:%' or t.title like 'Rückruf:%') and t.deleted_at is null
      and t.entity_id <> ${id}
    order by (t.due_at < now()) desc, t.due_at asc nulls last, t.created_at asc
    limit 1`;

  const name = `${c.firstName} ${c.lastName}`;
  const daten = await anrufDatenFuer(id, c.email as string);

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <Link
          href="/callcenter"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Zurück zur Warteschlange
        </Link>
        {next && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/callcenter/${next.candidate_id}?task=${next.task_id}`}>
              Nächster Anruf <SkipForward className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <PageHeader
        title={`Anruf · ${name}`}
        description={[c.profession, c.federalState, c.phone]
          .filter(Boolean)
          .join(" · ")}
      />

      {daten.profilLeer ? (
        <EmptyState
          icon={UserSquare2}
          title="Kein Matching-Profil vorhanden"
          description="Ohne Registrierungsprofil können keine passenden Jobs und Fragen vorbereitet werden. Du kannst trotzdem anrufen und die Angaben im Kandidatenprofil nachtragen."
          action={
            <Link
              href={`/kandidaten/${id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Zum Kandidatenprofil →
            </Link>
          }
        />
      ) : (
        <AnrufInterface
          applicationId={id}
          candidateName={name}
          email={c.email as string}
          phone={(c.phone as string) ?? null}
          taskId={taskId}
          topJobs={daten.topJobs}
          fragen={daten.fragen}
          gleichstand={daten.gleichstand}
          bearbeiter={bearbeiter}
          aktuellerBearbeiterId={aktuellerBearbeiterId}
        />
      )}
    </>
  );
}
