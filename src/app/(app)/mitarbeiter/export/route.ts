import { NextRequest } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { EMPLOYEE_STATUS } from "@/lib/definitions";

/** Ein CSV-Feld sicher quoten (Excel-kompatibel, mit Injection-Guard). */
function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Formel-Injection verhindern (=, +, -, @ am Anfang).
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  // Serverseitiges Gate: nur mit employees-Recht.
  await requireEmployee("employees");

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const like = `%${q}%`;
  const rolle = sp.get("rolle");
  const status = sp.get("status");
  const team = sp.get("team");

  const rows = await sql`
    select e.name, e.username, e.email, e.team, e.status, e.totp_enabled,
           e.last_login_at, r.name as role_name,
           (select count(*)::int from admin.candidate_meta cm
              where cm.assignee_id = e.id and cm.archived_at is null) as cand_count,
           (select count(*)::int from admin.company_meta co
              where co.assignee_id = e.id and co.archived_at is null) as comp_count,
           (select count(*)::int from admin.call_session cs
              where cs.employee_id = e.id and cs.deleted_at is null) as call_count,
           (select count(*)::int from admin.task t
              where t.assignee_id = e.id and t.status = 'OPEN' and t.deleted_at is null) as open_tasks
    from admin.employee e
    join admin.role r on r.id = e.role_id
    where e.deleted_at is null
      ${q ? sql`and (e.name ilike ${like} or e.email ilike ${like} or e.username ilike ${like})` : sql``}
      ${rolle ? sql`and e.role_id = ${rolle}` : sql``}
      ${status ? sql`and e.status = ${status}` : sql``}
      ${team ? sql`and e.team = ${team}` : sql``}
    order by e.name asc`;

  const header = [
    "Name", "Benutzername", "E-Mail", "Team", "Status", "Rolle", "2FA",
    "Kandidaten", "Unternehmen", "Telefonate", "Offene Aufgaben", "Letzter Login",
  ];
  const lines = [header.map(csvCell).join(";")];
  for (const r of rows) {
    const statusLabel = EMPLOYEE_STATUS[r.status as string]?.label ?? (r.status as string);
    lines.push(
      [
        r.name, r.username, r.email, r.team ?? "", statusLabel, r.role_name,
        r.totp_enabled ? "aktiv" : "aus",
        r.cand_count, r.comp_count, r.call_count, r.open_tasks,
        r.last_login_at ? new Date(r.last_login_at as Date).toISOString() : "nie",
      ].map(csvCell).join(";"),
    );
  }
  // BOM, damit Excel UTF-8/Umlaute korrekt erkennt.
  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mitarbeiter-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
