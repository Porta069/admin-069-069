import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { sql } from "@/lib/db";

/**
 * Gemeinsame KI-Basis nach der Werkpair-Token-Doktrin. JEDE KI-Funktion nutzt
 * diese Bausteine:
 *
 *  Stufe 0  Erst prüfen ob überhaupt KI nötig — deterministischer Code ist gratis.
 *  Stufe 1  Vorberechnen & speichern (cached()) — nie bei jedem Aufruf neu.
 *  Stufe 2  Prompt-Caching Pflicht — stabiler Prefix zuerst, cache_control.
 *  Stufe 3  Kleinstes ausreichendes Modell + Effort (MODELLE).
 *  Stufe 4  Kontext zuschneiden — nur das Nötige in den Prompt.
 *  Stufe 5  Structured Output + enges max_tokens, dichte Prompts.
 *
 * Jeder Aufruf schreibt einen Verbrauchs-Datensatz (admin.ki_usage).
 */

export function kiVerfuegbar(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function kiClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Stufe 3: feste Modell-/Effort-Zuordnung — nie im Feature-Code raten. */
export const MODELLE = {
  /** Mechanisch/klar: kurze Fragen, Klassifikation, Mini-Zusammenfassungen. */
  guenstig: { model: "claude-haiku-4-5", effort: "low" as const },
  /** Extraktion/Urteil mit Struktur: Intake, komplexere Zusammenfassungen. */
  standard: { model: "claude-sonnet-5", effort: "low" as const },
  /** Nur wenn Qualität nachweislich kritisch ist. */
  premium: { model: "claude-opus-5", effort: "medium" as const },
} as const;

export type ModellStufe = keyof typeof MODELLE;

/**
 * Stufe 2 (Prompt-Caching) — kritische Grenze: unterhalb dieser Token-Zahl
 * wird ein Prefix **still nicht** gecacht (kein Fehler, `cache_creation_tokens`
 * bleibt 0). Der Wert ist modellabhängig und NICHT monoton über Generationen.
 * Quelle: Anthropic Prompt-Caching-Doku (Stand 2026-08).
 */
export const MIN_CACHE_TOKENS: Record<string, number> = {
  "claude-opus-5": 512,
  "claude-fable-5": 512,
  "claude-opus-4-8": 1024,
  "claude-sonnet-5": 1024,
  "claude-sonnet-4-6": 1024,
  "claude-haiku-4-5": 4096,
};

/** Grobe Token-Schätzung (≈3,5 Zeichen/Token für DE/EN) — nur für Warnungen. */
export function schaetzeTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * Warnt im Dev-Modus, wenn ein System-Prompt unter der Cache-Mindestgröße des
 * Modells liegt — dann greift `cache_control` nicht und das Caching läuft leer.
 * Für kurze Prompts (z. B. `guenstig`/Haiku) ist das oft unvermeidbar; dort
 * trägt stattdessen der deterministische `cached()`-Speicher.
 */
export function pruefeCacheGroesse(model: string, systemPrompt: string): void {
  if (process.env.NODE_ENV === "production") return;
  const min = MIN_CACHE_TOKENS[model];
  if (!min) return;
  const geschaetzt = schaetzeTokens(systemPrompt);
  if (geschaetzt < min) {
    console.warn(
      `[ki] System-Prompt für ${model} ≈${geschaetzt} Tokens < Cache-Minimum ${min} — ` +
        `cache_control greift NICHT (still). Prefix vergrößern oder Caching bewusst hinnehmen.`,
    );
  }
}

interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Zentrales Verbrauchs-/Cache-Logging. Exportiert, damit ALLE KI-Aufrufe
 * (auch außerhalb `kiJson`, z. B. `ki-intake`) in `admin.ki_usage` sichtbar
 * werden — sonst fehlen ausgerechnet die Features mit großem, gut cachebarem
 * Prefix in der Cache-Auswertung. */
export async function logUsage(
  feature: string,
  model: string,
  usage: Usage | undefined,
  ok: boolean,
  actorId: string | null,
) {
  try {
    await sql`
      insert into admin.ki_usage
        (feature, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, ok, actor_id)
      values (${feature}, ${model}, ${usage?.input_tokens ?? 0}, ${usage?.output_tokens ?? 0},
              ${usage?.cache_read_input_tokens ?? 0}, ${usage?.cache_creation_input_tokens ?? 0},
              ${ok}, ${actorId})`;
  } catch (e) {
    console.error("ki_usage log failed", e);
  }
}

export interface KiJsonInput<T> {
  feature: string;
  stufe: ModellStufe;
  /** Stabiler Prefix — bekommt automatisch den Cache-Breakpoint. */
  system: string;
  /** Variabler Teil zuletzt. */
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  actorId?: string | null;
  /**
   * Cache-Lebensdauer des System-Prefix. Default "5m" (günstiger Write-Aufschlag
   * 1,25×). "1h" (Write 2×) nur für große, über Minuten hinweg wiederverwendete
   * Prompts — z. B. mehrrundige Intakes/Assistenten mit Denkpausen dazwischen.
   */
  ttl?: "5m" | "1h";
}

/**
 * Ein strukturierter KI-Aufruf nach allen Stufen: Prompt-Caching auf dem
 * System-Prompt, kleinstes Modell/Effort, Structured Output, Verbrauchs-Log.
 */
export async function kiJson<T>(
  input: KiJsonInput<T>,
): Promise<{ ok: true; data: T } | { ok: false; fehler: string }> {
  if (!kiVerfuegbar()) {
    return { ok: false, fehler: "KI ist nicht aktiviert (ANTHROPIC_API_KEY fehlt)." };
  }
  const { model, effort } = MODELLE[input.stufe];
  pruefeCacheGroesse(model, input.system);
  const cacheControl =
    input.ttl === "1h"
      ? ({ type: "ephemeral", ttl: "1h" } as const)
      : ({ type: "ephemeral" } as const);
  try {
    const response = await kiClient().messages.create({
      model,
      max_tokens: input.maxTokens ?? 2000,
      output_config: {
        effort,
        format: { type: "json_schema", schema: input.schema },
      },
      system: [{ type: "text", text: input.system, cache_control: cacheControl }],
      messages: [{ role: "user", content: input.user }],
    });
    await logUsage(input.feature, model, response.usage, true, input.actorId ?? null);

    if (response.stop_reason === "refusal") {
      return { ok: false, fehler: "Die KI hat die Anfrage abgelehnt." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, fehler: "Antwort zu lang — bitte Aufgabe verkleinern." };
    }
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, fehler: "Leere Antwort der KI." };
    }
    return { ok: true, data: JSON.parse(block.text) as T };
  } catch (err) {
    await logUsage(input.feature, model, undefined, false, input.actorId ?? null);
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, fehler: "Der ANTHROPIC_API_KEY ist ungültig." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, fehler: "KI-Kontingent kurz erschöpft — gleich erneut versuchen." };
    }
    console.error(`ki ${input.feature} fehler`, err);
    return { ok: false, fehler: "KI-Dienst momentan nicht erreichbar." };
  }
}

/**
 * Stufe 1 — Vorberechnen & speichern. Führt `compute` nur aus, wenn zum
 * Eingabe-Hash noch kein gültiges Ergebnis vorliegt.
 */
export async function cached<T>(
  feature: string,
  eingabe: unknown,
  compute: () => Promise<T>,
  ttlSekunden?: number,
): Promise<T> {
  const key =
    feature +
    ":" +
    crypto.createHash("sha256").update(JSON.stringify(eingabe)).digest("hex").slice(0, 32);
  const [hit] = await sql`
    select value from admin.ki_cache
    where cache_key = ${key} and (expires_at is null or expires_at > now())`;
  if (hit) return hit.value as T;
  const value = await compute();
  const expires = ttlSekunden
    ? new Date(Date.now() + ttlSekunden * 1000)
    : null;
  await sql`
    insert into admin.ki_cache (cache_key, feature, value, expires_at)
    values (${key}, ${feature}, ${sql.json(value as never)}, ${expires})
    on conflict (cache_key) do update set value = ${sql.json(value as never)}, created_at = now(), expires_at = ${expires}`;
  return value;
}
