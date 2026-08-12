import { NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { entityHref, type EntityType } from "@/lib/definitions";

export async function GET() {
  const employee = await getEmployee();
  if (!employee) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await sql`
    select id, type, title, body, priority, entity_type, entity_id,
           read_at, created_at
    from admin.notification
    where employee_id = ${employee.id}
    order by created_at desc
    limit 20`;

  return NextResponse.json({
    notifications: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      priority: r.priority,
      readAt: r.read_at,
      createdAt: r.created_at,
      href:
        // Registrierungs-Meldungen öffnen direkt den Job-Matching-Tab.
        r.type === "NEW_CANDIDATE" && r.entity_id
          ? `/kandidaten/${r.entity_id}?tab=matching`
          : r.entity_type && r.entity_id
            ? entityHref(r.entity_type as EntityType, r.entity_id as string)
            : null,
    })),
  });
}

/** Mark all notifications as read. */
export async function PATCH() {
  const employee = await getEmployee();
  if (!employee) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await sql`
    update admin.notification set read_at = now()
    where employee_id = ${employee.id} and read_at is null`;
  return NextResponse.json({ ok: true });
}
