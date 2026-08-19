import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { KandidatenSuche } from "./_components/kandidaten-suche";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kandidaten-Suche" };

export default async function KandidatenSuchePage() {
  const employee = await requireEmployee("matching");
  const canSave = can(employee, "jobs", "create");

  const companies = canSave
    ? await sql`select id, name, ort from public."Company" order by name asc limit 500`
    : [];

  return (
    <>
      <PageHeader
        title="Kandidaten-Suche"
        description="Kriterien wie im Registrierungsformular festlegen — links siehst du live die passenden Jobsuchenden. Optional als Stelle speichern und einem Unternehmen zuordnen."
      />
      <KandidatenSuche
        canSave={canSave}
        companies={companies.map((c) => ({
          id: c.id as string,
          name: c.name as string,
          ort: (c.ort as string | null) ?? null,
        }))}
      />
    </>
  );
}
