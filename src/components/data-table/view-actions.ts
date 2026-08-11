"use server";

import { getEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";

export interface SavedViewItem {
  id: string;
  name: string;
  query: string;
}

export async function listViewsAction(module: string): Promise<SavedViewItem[]> {
  const employee = await getEmployee();
  if (!employee) return [];
  const rows = await sql`
    select id, name, config from admin.saved_view
    where employee_id = ${employee.id} and module = ${module}
    order by created_at desc limit 30`;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    query: ((r.config as { query?: string })?.query ?? "") as string,
  }));
}

export async function saveViewAction(
  module: string,
  name: string,
  query: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const employee = await getEmployee();
    if (!employee) return { ok: false, message: "Nicht angemeldet." };
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return { ok: false, message: "Bitte einen Namen angeben." };
    await sql`
      insert into admin.saved_view (employee_id, module, name, config)
      values (${employee.id}, ${module}, ${trimmed}, ${sql.json({ query })})`;
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Ansicht konnte nicht gespeichert werden." };
  }
}

export async function deleteViewAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const employee = await getEmployee();
    if (!employee) return { ok: false, message: "Nicht angemeldet." };
    await sql`
      delete from admin.saved_view
      where id = ${id} and employee_id = ${employee.id}`;
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Ansicht konnte nicht gelöscht werden." };
  }
}
