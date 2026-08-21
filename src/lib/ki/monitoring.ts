import "server-only";
import { sql } from "@/lib/db";
import { MODELL_PREISE } from "./kosten";

/**
 * Cache-Monitoring über `admin.ki_usage`. Beantwortet die einzige Frage, die
 * beim Prompt-Caching zählt: **greift es überhaupt?** Kennzahl ist die
 * Cache-Trefferquote (cache_read / gesamter Prompt-Input). 0 % trotz
 * gesetztem `cache_control` heißt fast immer: Prefix unter der Modell-Mindest-
 * größe (siehe MIN_CACHE_TOKENS) oder ein stiller Invalidator im Prompt.
 */

const USD_ZU_EUR = 0.92;

export interface KiCacheZeile {
  feature: string;
  model: string;
  calls: number;
  freshInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  /** Anteil des Prompt-Inputs, der aus dem Cache kam (0..1). */
  hitRate: number;
  /** Grob geschätzte EUR-Ersparnis vs. „alles ungecacht". */
  ersparnisEuro: number;
}

export interface KiCacheReport {
  seitTagen: number;
  zeilen: KiCacheZeile[];
  gesamt: {
    calls: number;
    promptTokens: number;
    cacheReadTokens: number;
    hitRate: number;
    ersparnisEuro: number;
  };
}

/**
 * Cache-Ersparnis einer Zeile: Cache-Reads kosten ~0,1× Input, ungecacht 1×.
 * Der Write-Aufschlag (1,25×/2×) wird als kleine Gegenbuchung angenähert.
 */
function ersparnis(
  model: string,
  readTokens: number,
  writeTokens: number,
): number {
  const preis = MODELL_PREISE[model];
  if (!preis) return 0;
  const proToken = preis.in / 1_000_000;
  const gespartUsd = readTokens * proToken * 0.9; // 1× → 0,1×
  const writeAufschlagUsd = writeTokens * proToken * 0.25; // 5m-Write ~1,25×
  return Math.max(0, (gespartUsd - writeAufschlagUsd) * USD_ZU_EUR);
}

export async function kiCacheStats(seitTagen = 30): Promise<KiCacheReport> {
  const rows = await sql`
    select feature, model,
           count(*)::int                        as calls,
           coalesce(sum(input_tokens), 0)::bigint       as fresh_input,
           coalesce(sum(cache_read_tokens), 0)::bigint  as cache_read,
           coalesce(sum(cache_write_tokens), 0)::bigint as cache_write,
           coalesce(sum(output_tokens), 0)::bigint      as output
    from admin.ki_usage
    where ok = true
      and created_at > now() - ${`${seitTagen} days`}::interval
    group by feature, model
    order by calls desc`;

  const zeilen: KiCacheZeile[] = rows.map((r) => {
    const fresh = Number(r.fresh_input);
    const read = Number(r.cache_read);
    const write = Number(r.cache_write);
    const promptInput = fresh + read;
    return {
      feature: r.feature as string,
      model: r.model as string,
      calls: r.calls as number,
      freshInputTokens: fresh,
      cacheReadTokens: read,
      cacheWriteTokens: write,
      outputTokens: Number(r.output),
      hitRate: promptInput > 0 ? read / promptInput : 0,
      ersparnisEuro: ersparnis(r.model as string, read, write),
    };
  });

  const promptTokens = zeilen.reduce(
    (s, z) => s + z.freshInputTokens + z.cacheReadTokens,
    0,
  );
  const cacheReadTokens = zeilen.reduce((s, z) => s + z.cacheReadTokens, 0);

  return {
    seitTagen,
    zeilen,
    gesamt: {
      calls: zeilen.reduce((s, z) => s + z.calls, 0),
      promptTokens,
      cacheReadTokens,
      hitRate: promptTokens > 0 ? cacheReadTokens / promptTokens : 0,
      ersparnisEuro: zeilen.reduce((s, z) => s + z.ersparnisEuro, 0),
    },
  };
}
