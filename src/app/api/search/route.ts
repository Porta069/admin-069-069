import { NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";

/**
 * Global search across candidates, companies, jobs, applications and notes.
 * Results are permission-filtered per module before anything is returned.
 */
export async function GET(request: Request) {
  const employee = await getEmployee();
  if (!employee) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  const like = `%${q}%`;

  const results: Array<{
    type: string;
    id: string;
    title: string;
    subtitle: string | null;
    href: string;
  }> = [];

  const jobs: Promise<void>[] = [];

  if (hasPermission(employee.permissions, "candidates")) {
    jobs.push(
      sql`
        select id, "firstName", "lastName", profession, "federalState"
        from admin.candidate
        where status <> 'ERASED'
          and ("firstName" || ' ' || "lastName" ilike ${like}
            or email ilike ${like}
            or profession ilike ${like})
        order by "createdAt" desc
        limit 5`.then((rows) => {
        for (const r of rows) {
          results.push({
            type: "candidate",
            id: r.id,
            title: `${r.firstName} ${r.lastName}`,
            subtitle: [r.profession, r.federalState].filter(Boolean).join(" · ") || null,
            href: `/kandidaten/${r.id}`,
          });
        }
      }),
    );
  }

  if (hasPermission(employee.permissions, "companies")) {
    jobs.push(
      sql`
        select id, name, ort
        from public."Company"
        where name ilike ${like} or ort ilike ${like} or "kontaktName" ilike ${like}
        order by "createdAt" desc
        limit 5`.then((rows) => {
        for (const r of rows) {
          results.push({
            type: "company",
            id: r.id,
            title: r.name,
            subtitle: r.ort ?? null,
            href: `/unternehmen/${r.id}`,
          });
        }
      }),
    );
  }

  if (hasPermission(employee.permissions, "jobs")) {
    jobs.push(
      sql`
        select j.id, j.title, c.name as company
        from public."JobPosting" j
        left join public."Company" c on c.id = j."companyId"
        where j.title ilike ${like} or c.name ilike ${like}
        order by j."createdAt" desc
        limit 5`.then((rows) => {
        for (const r of rows) {
          results.push({
            type: "job",
            id: r.id,
            title: r.title,
            subtitle: r.company ?? null,
            href: `/stellen/${r.id}`,
          });
        }
      }),
    );
  }

  if (hasPermission(employee.permissions, "applications")) {
    jobs.push(
      sql`
        select ja.id, u.email as applicant, j.title as job
        from public."JobApplication" ja
        left join public."User" u on u.id = ja."userId"
        left join public."JobPosting" j on j.id = ja."jobPostingId"
        where u.email ilike ${like} or j.title ilike ${like}
        order by ja."createdAt" desc
        limit 5`.then((rows) => {
        for (const r of rows) {
          results.push({
            type: "application",
            id: r.id,
            title: r.job ?? "Bewerbung",
            subtitle: r.applicant ?? null,
            href: `/bewerbungen/${r.id}`,
          });
        }
      }),
    );
  }

  if (hasPermission(employee.permissions, "notes")) {
    jobs.push(
      sql`
        select id, content, category, entity_type, entity_id
        from admin.note
        where deleted_at is null and content ilike ${like}
        order by created_at desc
        limit 5`.then((rows) => {
        for (const r of rows) {
          results.push({
            type: "note",
            id: r.id,
            title: (r.content as string).slice(0, 60),
            subtitle: r.category,
            href: `/notizen`,
          });
        }
      }),
    );
  }

  await Promise.allSettled(jobs);

  return NextResponse.json({ results: results.slice(0, 25) });
}
