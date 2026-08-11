import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { GermanyMap } from "./_components/germany-map";

export default async function KartePage() {
  await requireEmployee("map");

  const [companies, jobs, [counts]] = await Promise.all([
    sql`
      select c.id, c.name, c.ort, c.lat::float as lat, c.lng::float as lng,
        (select count(*)::int from public."JobPosting" j
         where j."companyId" = c.id and j.status = 'ACTIVE') as jobs_count
      from public."Company" c
      where c.lat is not null and c.lng is not null
      limit 3000`,
    sql`
      select j.id, j.title, j.city, j.lat::float as lat, j.lng::float as lng
      from public."JobPosting" j
      where j.status = 'ACTIVE' and j.lat is not null and j.lng is not null
      limit 3000`,
    sql`
      select
        (select count(*)::int from public."Company"
         where lat is null or lng is null) as companies_unlocated,
        (select count(*)::int from public."JobPosting"
         where status = 'ACTIVE' and (lat is null or lng is null)) as jobs_unlocated`,
  ]);

  const mapCompanies = companies.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    ort: (c.ort as string) ?? null,
    lat: c.lat as number,
    lng: c.lng as number,
    jobsCount: c.jobs_count as number,
  }));
  const mapJobs = jobs.map((j) => ({
    id: j.id as string,
    title: j.title as string,
    city: (j.city as string) ?? null,
    lat: j.lat as number,
    lng: j.lng as number,
  }));

  const unlocated =
    (counts.companies_unlocated as number) + (counts.jobs_unlocated as number);

  return (
    <>
      <PageHeader
        title="Karte"
        description="Unternehmen und aktive Stellen in Deutschland verorten."
      />

      <GermanyMap companies={mapCompanies} jobs={mapJobs} />

      <p className="mt-3 text-sm text-muted-foreground tabular">
        {formatNumber(mapCompanies.length)} Unternehmen /{" "}
        {formatNumber(mapJobs.length)} Jobs verortet ·{" "}
        {formatNumber(unlocated)} ohne Koordinaten
      </p>
    </>
  );
}
