import { NextResponse } from "next/server";
import { getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { effektivePraesenz } from "@/lib/presence";

const MANUELL = new Set(["AVAILABLE", "ABWESEND", "URLAUB"]);

/**
 * Präsenz-Endpunkt.
 *  - Ohne Body / {}: Heartbeat — setzt last_seen_at (hält „online").
 *  - { status: 'AVAILABLE'|'ABWESEND'|'URLAUB' }: manueller Zustand.
 *  - { call: 'start'|'end' }: setzt/entfernt 'IM_CALL' (Telefonzentrale).
 */
export async function POST(req: Request) {
  const employee = await getEmployee();
  if (!employee) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: string; call?: string } = {};
  try {
    body = await req.json();
  } catch {
    // leerer Body = reiner Heartbeat
  }

  if (body.call === "start") {
    await sql`update admin.employee set presence = 'IM_CALL', last_seen_at = now() where id = ${employee.id}`;
  } else if (body.call === "end") {
    await sql`update admin.employee set presence = 'AVAILABLE', last_seen_at = now() where id = ${employee.id}`;
  } else if (body.status && MANUELL.has(body.status)) {
    await sql`update admin.employee set presence = ${body.status}, last_seen_at = now() where id = ${employee.id}`;
  } else {
    await sql`update admin.employee set last_seen_at = now() where id = ${employee.id}`;
  }

  const [row] = await sql`
    select presence, last_seen_at from admin.employee where id = ${employee.id}`;
  return NextResponse.json({
    presence: row?.presence ?? "AVAILABLE",
    effektiv: effektivePraesenz(row?.presence as string, row?.last_seen_at as Date),
  });
}
