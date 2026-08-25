import "server-only";
import { sql } from "./db";
import { typZuGruppe, istGruppeAktiv, type NtfyPrefs } from "./ntfy-groups";
import { entityHref, type EntityType } from "./definitions";

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

/**
 * Sendet einen Push an EINEN Topic. Fire-and-forget, Fehler werden geschluckt.
 *
 * Wir publizieren im JSON-Format an die Server-Wurzel (nicht per HTTP-Headern),
 * damit Titel/Text Emoji und Umlaute enthalten dürfen — Header-Werte müssen
 * Latin-1 sein, `fetch` wirft sonst bei Nicht-ASCII (z. B. „✅"/„💬").
 */
export async function sendeNtfy(topic: string, push: NtfyPush): Promise<void> {
  if (!topic) return;
  const prio = push.priority ?? "NORMAL";
  const payload: Record<string, unknown> = {
    topic,
    title: einzeilig(push.title),
    message: (push.body ?? push.title).slice(0, 3500),
    priority: Number(PRIO_HEADER[prio] ?? "3"),
    tags: [PRIO_TAG[prio] ?? "bell"],
  };
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  if (base && push.clickPath) {
    payload.click = `${base}${push.clickPath.startsWith("/") ? "" : "/"}${push.clickPath}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NTFY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(SERVER, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch {
    // Push ist „best effort" — die In-App-Mitteilung bleibt die Quelle der Wahrheit.
  }
}

/**
 * Zentrale Push-Zustellung an mehrere Mitarbeiter für einen Notification-`type`.
 * Schlägt Topic UND Präferenzen je Empfänger nach und pusht nur, wenn (a) ein
 * Topic gesetzt ist und (b) die zugehörige Gruppe in den Präferenzen aktiv ist.
 * Blockiert die Anfrage nur kurz (best effort).
 */
export async function pushAnMitarbeiter(
  employeeIds: string[],
  push: NtfyPush & {
    type: string;
    entityType?: string | null;
    entityId?: string | null;
  },
): Promise<void> {
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (ids.length === 0) return;
  const gruppe = typZuGruppe(push.type);
  // Klick-Ziel aus Entity ableiten, falls nicht explizit gesetzt.
  const clickPath =
    push.clickPath ??
    (push.entityType && push.entityId
      ? entityHref(push.entityType as EntityType, push.entityId)
      : null);
  const einzelPush: NtfyPush = {
    title: push.title,
    body: push.body ?? null,
    priority: push.priority,
    clickPath,
  };
  let rows: { ntfy_topic: string | null; ntfy_prefs: NtfyPrefs }[] = [];
  try {
    rows = (await sql`
      select ntfy_topic, ntfy_prefs from admin.employee
      where id = any(${ids}::uuid[]) and ntfy_topic is not null`) as {
      ntfy_topic: string | null;
      ntfy_prefs: NtfyPrefs;
    }[];
  } catch {
    return;
  }
  const ziele = rows
    .filter((r) => r.ntfy_topic && istGruppeAktiv(r.ntfy_prefs, gruppe))
    .map((r) => r.ntfy_topic as string);
  await Promise.allSettled(ziele.map((t) => sendeNtfy(t, einzelPush)));
}

function einzeilig(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 200);
}
