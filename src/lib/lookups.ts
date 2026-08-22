import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";

/**
 * Filter-Dropdown-Quellen für die Listenseiten. Diese distinct/group-by-Abfragen
 * über große Plattform-Tabellen laufen sonst bei JEDEM Listenaufruf, liefern aber
 * fast immer dasselbe. Sie werden deshalb zwischengespeichert — invalidiert über
 * dieselben Tags (`candidates`/`jobs`), die die Mutations-Actions ohnehin schon
 * per revalidateTag setzen. Dadurch: sofortige Auffrischung bei relevanten
 * Änderungen, KEINE zusätzliche Verzögerung (die revalidate-Zeit ist nur ein
 * Sicherheitsnetz). Verhalten unverändert.
 */

const REVALIDATE = 300;

/** Bundesländer, in denen Kandidaten registriert sind. */
export const getCandidateFederalStates = unstable_cache(
  async () =>
    await sql<{ federalState: string }[]>`
      select distinct "federalState" from admin.candidate
      where status <> 'ERASED' and "federalState" is not null
      order by 1 limit 30`,
  ["lookup-candidate-federalstates"],
  { revalidate: REVALIDATE, tags: ["candidates"] },
);

/** Häufigste Berufe der Kandidaten (nach Anzahl). */
export const getCandidateProfessions = unstable_cache(
  async () =>
    await sql<{ profession: string }[]>`
      select profession from admin.candidate
      where status <> 'ERASED' and profession is not null
      group by profession order by count(*) desc limit 30`,
  ["lookup-candidate-professions"],
  { revalidate: REVALIDATE, tags: ["candidates"] },
);

/** Häufigste Gewerke aktiver/registrierter Stellen. */
export const getJobGewerke = unstable_cache(
  async () =>
    await sql<{ gewerk: string }[]>`
      select gewerk from public."JobPosting"
      where gewerk is not null
      group by gewerk order by count(*) desc limit 30`,
  ["lookup-job-gewerke"],
  { revalidate: REVALIDATE, tags: ["jobs"] },
);

/** Häufigste Städte der Stellen. */
export const getJobCities = unstable_cache(
  async () =>
    await sql<{ city: string }[]>`
      select city from public."JobPosting"
      where city is not null
      group by city order by count(*) desc limit 30`,
  ["lookup-job-cities"],
  { revalidate: REVALIDATE, tags: ["jobs"] },
);

/** Unternehmen mit Stellen (Filter „Unternehmen" der Stellenliste). */
export const getJobCompanies = unstable_cache(
  async () =>
    await sql<{ id: string; name: string }[]>`
      select c.id, c.name
      from public."Company" c
      join public."JobPosting" j on j."companyId" = c.id
      group by c.id, c.name
      order by count(*) desc limit 20`,
  ["lookup-job-companies"],
  { revalidate: REVALIDATE, tags: ["jobs"] },
);
