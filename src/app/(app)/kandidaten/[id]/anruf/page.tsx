import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { firstParam, type SearchParams } from "@/lib/table-params";
import { anrufDatenFuer } from "@/lib/matching/anruf";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
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
    from public."Application" a
    where a.id = ${id} and a.status <> 'ERASED' limit 1`;
  if (!c) notFound();

  const name = `${c.firstName} ${c.lastName}`;
  const daten = await anrufDatenFuer(id, c.email as string);

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
        />
      )}
    </>
  );
}
