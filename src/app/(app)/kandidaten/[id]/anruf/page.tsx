import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { anrufDatenFuer } from "@/lib/matching/anruf";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { RegistrierungsAntworten } from "@/components/candidate/registrierungs-antworten";
import { AnrufInterface } from "./_components/anruf-interface";
import { ArrowLeft, UserSquare2 } from "lucide-react";

export const metadata = { title: "Anruf" };

export default async function AnrufPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireEmployee("candidates", "edit");
  const { id } = await params;
  const { task } = await searchParams;
  const taskId = firstParam(task) ?? null;

  const [c] = await sql`
    select a.id, a."firstName", a."lastName", a.email, a.phone, a.profession,
           a."federalState"
    from admin.candidate a
    where a.id = ${id} and a.status <> 'ERASED' limit 1`;
  if (!c) notFound();

  const name = `${c.firstName} ${c.lastName}`;
  const [daten, [userRow]] = await Promise.all([
    anrufDatenFuer(id, c.email as string),
    sql<{ profileData: unknown }[]>`
      select "profileData" from public."User" where email = ${c.email} limit 1`,
  ]);

  return (
    <>
      <div className="mb-1">
        <Link
          href={`/kandidaten/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Zurück zum Kandidaten
        </Link>
      </div>
      <PageHeader
        title={`Anruf · ${name}`}
        description={[c.profession, c.federalState, c.phone]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-5">
        <RegistrierungsAntworten
          profileData={userRow?.profileData ?? null}
          title="Das hat der Kandidat angegeben"
        />
      </div>

      {daten.profilLeer ? (
        <EmptyState
          icon={UserSquare2}
          title="Kein Matching-Profil vorhanden"
          description="Ohne Registrierungsprofil können keine passenden Jobs und Fragen vorbereitet werden. Du kannst den Kandidaten trotzdem anrufen und die Angaben manuell im Profil nachtragen."
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
        />
      )}
    </>
  );
}
