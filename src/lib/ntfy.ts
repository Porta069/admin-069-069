import "server-only";
import { sql } from "./db";

/**
 * Handy-Push über ntfy (https://ntfy.sh — kostenlos, kein Account nötig).
 *
 * Prinzip: Jeder Mitarbeiter hat einen geheimen, zufälligen Topic-Namen
 * (admin.employee.ntfy_topic). Die ntfy-App auf dem Handy abonniert genau
 * diesen Topic; hier pushen wir Nachrichten dorthin. Weil der Topic-Name lang
 * und zufällig ist, ist er praktisch privat.
 *
 * Optionale Env-Variablen:
 *  - NTFY_SERVER  eigener/anderer ntfy-Server (Standard: https://ntfy.sh)
 *  - NTFY_TOKEN   Bearer-Token für geschützte Topics (bei ntfy.sh nicht nötig)
 *  - APP_URL      Basis-URL fürs Antippen (öffnet das Dashboard)
 */

const SERVER = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

export interface NtfyPush {
  title: string;
  body?: string | null;
  priority?: "NORMAL" | "HOCH" | "DRINGEND";
  /** Relativer Pfad im Dashboard (öffnet sich beim Antippen, wenn APP_URL gesetzt). */
  clickPath?: string | null;
}

const PRIO_HEADER: Record<string, string> = {
  NORMAL: "3",
  HOCH: "4",
  DRINGEND: "5",
};
const PRIO_TAG: Record<string, string> = {
  NORMAL: "bell",
  HOCH: "warning",
  DRINGEND: "rotating_light",
};

/** Sendet einen Push an EINEN Topic. Fire-and-forget, Fehler werden geschluckt. */
export async function sendeNtfy(topic: string, push: NtfyPush): Promise<void> {
  if (!topic) return;
  const prio = push.priority ?? "NORMAL";
  const headers: Record<string, string> = {
    // Titel/Tags dürfen kein rohes Newline enthalten → in Header sicher halten.
    Title: einzeilig(push.title),
    Priority: PRIO_HEADER[prio] ?? "3",
    Tags: PRIO_TAG[prio] ?? "bell",
  };
  if (process.env.NTFY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  }
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  if (base && push.clickPath) {
    headers.Click = `${base}${push.clickPath.startsWith("/") ? "" : "/"}${push.clickPath}`;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(`${SERVER}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers,
      body: (push.body ?? push.title).slice(0, 3500),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch {
    // Push ist „best effort" — die In-App-Mitteilung bleibt die Quelle der Wahrheit.
  }
}

/**
 * Push an mehrere Mitarbeiter: schlägt deren Topics nach und sendet an alle,
 * die Handy-Benachrichtigungen aktiviert haben. Blockiert die Anfrage nur kurz.
 */
export async function sendeNtfyAnMitarbeiter(
  employeeIds: string[],
  push: NtfyPush,
): Promise<void> {
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (ids.length === 0) return;
  let rows: { ntfy_topic: string | null }[] = [];
  try {
    rows = (await sql`
      select ntfy_topic from admin.employee
      where id = any(${ids}::uuid[]) and ntfy_topic is not null`) as {
      ntfy_topic: string | null;
    }[];
  } catch {
    return;
  }
  const topics = rows.map((r) => r.ntfy_topic).filter((t): t is string => Boolean(t));
  await Promise.allSettled(topics.map((t) => sendeNtfy(t, push)));
}

function einzeilig(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 200);
}
