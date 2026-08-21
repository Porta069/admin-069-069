/**
 * Verifikations-Harness für Prompt-Caching (Stufe 2 der Token-Doktrin).
 *
 * Beweist an echten API-Aufrufen, dass `cache_control` greift, und dokumentiert
 * die stillen Fehlerfälle (Prefix unter Modell-Minimum, veränderter Prefix).
 *
 * Ausführen (ANTHROPIC_API_KEY muss gesetzt sein):
 *   npx tsx scripts/test-prompt-caching.ts
 *
 * Erwartung: bei einem ausreichend großen, stabilen System-Prefix ist
 * `cache_read_input_tokens` ab dem 2. Aufruf > 0 (Trefferquote steigt).
 */
import Anthropic from "@anthropic-ai/sdk";

const MIN_CACHE_TOKENS: Record<string, number> = {
  "claude-opus-5": 512,
  "claude-sonnet-5": 1024,
  "claude-haiku-4-5": 4096,
};

// Großer, stabiler System-Prompt (~1,5k Tokens) — sicher über dem Sonnet-Minimum.
const BIG_SYSTEM =
  "Du bist ein Extraktions-Assistent für ein Recruiting-CRM. " +
  "Antworte ausschließlich mit einem JSON-Objekt {\"ok\": true}. " +
  "Regeln, die du strikt befolgst:\n" +
  Array.from({ length: 120 }, (_, i) =>
    `${i + 1}. Kriterium ${i + 1}: prüfe Feld sorgfältig und normalisiere Freitext auf Katalogwerte.`,
  ).join("\n");

const SMALL_SYSTEM = "Antworte nur mit {\"ok\": true}."; // weit unter jedem Minimum

const SCHEMA = {
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
} as const;

interface Fall {
  name: string;
  model: string;
  system: string;
  wiederholungen: number;
  ttl?: "1h";
  erwarteHit: boolean;
}

const FAELLE: Fall[] = [
  {
    name: "1) Sonnet, großer Prefix, 3× identisch → Cache greift",
    model: "claude-sonnet-5",
    system: BIG_SYSTEM,
    wiederholungen: 3,
    erwarteHit: true,
  },
  {
    name: "2) Sonnet, großer Prefix, 1h-TTL → Cache greift",
    model: "claude-sonnet-5",
    system: BIG_SYSTEM,
    wiederholungen: 3,
    ttl: "1h",
    erwarteHit: true,
  },
  {
    name: "3) Sonnet, kleiner Prefix (<1024) → still KEIN Cache",
    model: "claude-sonnet-5",
    system: SMALL_SYSTEM,
    wiederholungen: 3,
    erwarteHit: false,
  },
  {
    name: "4) Haiku, großer Prefix, aber <4096 → still KEIN Cache",
    model: "claude-haiku-4-5",
    system: BIG_SYSTEM, // ~1,5k < 4096 Haiku-Minimum
    wiederholungen: 3,
    erwarteHit: false,
  },
  {
    name: "5) Opus, großer Prefix (>512) → Cache greift schon früh",
    model: "claude-opus-5",
    system: BIG_SYSTEM,
    wiederholungen: 3,
    erwarteHit: true,
  },
];

async function run() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("ANTHROPIC_API_KEY fehlt — Test übersprungen.");
    process.exit(2);
  }
  const client = new Anthropic();
  let bestanden = 0;

  for (const fall of FAELLE) {
    const geschaetzt = Math.ceil(fall.system.length / 3.5);
    const min = MIN_CACHE_TOKENS[fall.model] ?? 0;
    let maxRead = 0;
    let firstWrite = 0;

    for (let i = 0; i < fall.wiederholungen; i++) {
      const res = await client.messages.create({
        model: fall.model,
        max_tokens: 64,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        system: [
          {
            type: "text",
            text: fall.system,
            cache_control: fall.ttl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: `Aufruf ${i + 1}` }],
      });
      const u = res.usage;
      if (i === 0) firstWrite = u.cache_creation_input_tokens ?? 0;
      maxRead = Math.max(maxRead, u.cache_read_input_tokens ?? 0);
      // Zwischen den Aufrufen kurz warten: Cache wird erst nach Streaming-Beginn lesbar.
    }

    const hat = maxRead > 0;
    const ok = hat === fall.erwarteHit;
    if (ok) bestanden++;
    console.log(
      `${ok ? "✓" : "✗"} ${fall.name}\n` +
        `    Prefix≈${geschaetzt} Tok (Min ${min}) · 1. Write=${firstWrite} · max cache_read=${maxRead} · erwartet Hit=${fall.erwarteHit}`,
    );
  }

  console.log(`\n${bestanden}/${FAELLE.length} Fälle wie erwartet.`);
  process.exit(bestanden === FAELLE.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
