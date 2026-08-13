import { getEmployee } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

/**
 * DSGVO-Auskunftsexport für einen Kandidaten: alle plattform- und
 * admin-seitigen Daten als JSON-Download. Permission: candidates:export.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const employee = await getEmployee();
  if (!employee) {
    return new Response("Nicht angemeldet", { status: 401 });
  }
  if (!hasPermission(employee.permissions, "candidates", "export")) {
    return new Response("Keine Berechtigung für den Export", { status: 403 });
  }

  try {
    const [application] = await sql`
      select * from admin.candidate
      where id = ${id} and status <> 'ERASED'
      limit 1`;
    if (!application) {
      return new Response("Kandidat nicht gefunden", { status: 404 });
    }

    const [documents, notes, tasks, communications, appointments, auditEvents] =
      await Promise.all([
        sql`select id, type::text as type, "originalName", "mimeType",
                   "sizeBytes", "createdAt"
            from public."Document" where "applicationId" = ${id}
            order by "createdAt" desc`,
        sql`select n.id, n.content, n.category, n.pinned, n.created_at,
                   e.name as author_name
            from admin.note n
            left join admin.employee e on e.id = n.author_id
            where n.entity_type = 'candidate' and n.entity_id = ${id}
              and n.deleted_at is null
            order by n.created_at desc`,
        sql`select t.id, t.title, t.description, t.status, t.priority,
                   t.due_at, t.completed_at, t.created_at,
                   e.name as assignee_name
            from admin.task t
            left join admin.employee e on e.id = t.assignee_id
            where t.entity_type = 'candidate' and t.entity_id = ${id}
              and t.deleted_at is null
            order by t.created_at desc`,
        sql`select k.id, k.channel, k.direction, k.subject, k.body,
                   k.occurred_at, e.name as employee_name
            from admin.communication k
            left join admin.employee e on e.id = k.employee_id
            where k.entity_type = 'candidate' and k.entity_id = ${id}
              and k.deleted_at is null
            order by k.occurred_at desc`,
        sql`select a.id, a.title, a.description, a.starts_at, a.ends_at,
                   a.location, a.status, e.name as employee_name
            from admin.appointment a
            left join admin.employee e on e.id = a.employee_id
            where a.entity_type = 'candidate' and a.entity_id = ${id}
              and a.deleted_at is null
            order by a.starts_at desc`,
        sql`select al.id, al.action, al.metadata, al.created_at,
                   e.name as actor_name
            from admin.audit_log al
            left join admin.employee e on e.id = al.actor_id
            where al.entity_type = 'candidate' and al.entity_id = ${id}
            order by al.created_at desc
            limit 1000`,
      ]);

    const payload = {
      exportInfo: {
        typ: "DSGVO-Auskunftsexport",
        kandidatId: id,
        erstelltAm: new Date().toISOString(),
        erstelltVon: employee.name,
      },
      kandidat: application,
      dokumente: documents,
      notizen: notes,
      aufgaben: tasks,
      kommunikation: communications,
      termine: appointments,
      auditEintraege: auditEvents,
    };

    await recordAudit({
      actorId: employee.id,
      action: "export.dsgvo",
      entityType: "candidate",
      entityId: id,
      metadata: {
        dokumente: documents.length,
        notizen: notes.length,
        aufgaben: tasks.length,
        kommunikation: communications.length,
        auditEintraege: auditEvents.length,
      },
    });

    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
    }).format(new Date());

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dsgvo-kandidat-${id}-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("DSGVO-Export fehlgeschlagen", e);
    return new Response("Export fehlgeschlagen. Bitte erneut versuchen.", {
      status: 500,
    });
  }
}
