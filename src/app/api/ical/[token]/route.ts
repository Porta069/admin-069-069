import { sql } from "@/lib/db";

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Privater iCal-Feed pro Mitarbeiter (Token aus /konto).
 * Read-only; ungültige Tokens liefern 404 ohne weitere Information.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return new Response("Not found", { status: 404 });
  }

  const [employee] = await sql`
    select id, name from admin.employee
    where ical_token = ${token} and deleted_at is null and status = 'ACTIVE'`;
  if (!employee) {
    return new Response("Not found", { status: 404 });
  }

  const appointments = await sql`
    select id, title, description, location, starts_at, ends_at, status
    from admin.appointment
    where employee_id = ${employee.id} and deleted_at is null
      and starts_at > now() - interval '90 days'
    order by starts_at
    limit 500`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Werkpair//Admin//DE",
    `X-WR-CALNAME:Werkpair — ${icsEscape(employee.name as string)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
  ];
  for (const a of appointments) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:pw-${a.id}@portawerk`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(new Date(a.starts_at as string))}`,
      `DTEND:${icsDate(new Date(a.ends_at as string))}`,
      `SUMMARY:${icsEscape(a.title as string)}`,
      ...(a.description ? [`DESCRIPTION:${icsEscape(a.description as string)}`] : []),
      ...(a.location ? [`LOCATION:${icsEscape(a.location as string)}`] : []),
      ...(a.status === "CANCELLED" ? ["STATUS:CANCELLED"] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="portawerk.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
