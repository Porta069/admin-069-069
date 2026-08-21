# Prompt Caching (Stufe 2 der Token-Doktrin)

Wie Claude-Prompt-Caching in diesem Dashboard umgesetzt ist, wo es greift, wo
bewusst nicht — und wie man es überwacht.

## Kurzfassung

- **Zentrale Schicht:** Alle KI-Aufrufe laufen über `src/lib/ki/index.ts`
  (`kiJson`) bzw. den Intake in `src/lib/ki-intake.ts`. Beide setzen
  `cache_control` automatisch auf den **stabilen System-Prompt** (Prefix zuerst,
  variabler `user`-Teil zuletzt).
- **Metriken:** Jeder Aufruf schreibt `cache_read_tokens` / `cache_write_tokens`
  nach `admin.ki_usage`. Auswertung über `kiCacheStats()`
  (`src/lib/ki/monitoring.ts`), sichtbar unter **`/assistent` → KI-Cache**.
- **Kennzahl:** Cache-Trefferquote = `cache_read / (fresh_input + cache_read)`.

## Die eine Regel, aus der alles folgt

Caching ist ein **Prefix-Match**. Reihenfolge des gerenderten Prompts:
`tools → system → messages`. Jede Byte-Änderung im Prefix macht den Cache ab
dieser Stelle ungültig. Deshalb:

- System-Prompt **eingefroren** halten — kein `Date.now()`, keine UUIDs, keine
  pro-Request-IDs, kein `JSON.stringify` ohne stabile Schlüssel-Reihenfolge im
  Prefix. Variables gehört in den `user`-Teil.
- `kiJson` erzwingt das strukturell: `system` = stabiler Prefix mit Breakpoint,
  `user` = variabel, ohne Marker.

## ⚠️ Modell-Mindestgröße — der stille Fehlerfall

Unterhalb einer modellabhängigen Token-Grenze wird ein Prefix **still nicht
gecacht** (kein Fehler, `cache_write_tokens` bleibt 0):

| Modell | Stufe | Cache-Minimum |
|---|---|---|
| `claude-opus-5` | premium | **512** |
| `claude-sonnet-5` | standard | **1024** |
| `claude-haiku-4-5` | guenstig | **4096** |

Konstanten: `MIN_CACHE_TOKENS` in `src/lib/ki/index.ts`. Im Dev-Modus warnt
`pruefeCacheGroesse(model, system)`, wenn ein System-Prompt darunter liegt.

**Konsequenz für dieses Projekt:** Die kurzen `guenstig`-Features
(Zusammenfassung, Pitch, Fragen auf Haiku) haben System-Prompts weit unter 4096
Tokens → Prompt-Caching greift dort **nie** und ist auch nicht das richtige
Werkzeug. Dort trägt stattdessen der **deterministische `cached()`-Speicher**
(`admin.ki_cache`): identische Eingabe ⇒ gar kein API-Aufruf.

Prompt-Caching zahlt sich hier an genau einer Stelle aus: **`unternehmen_intake`**
(`claude-sonnet-5`, großer stabiler System-Prompt + Katalog, über die mehrrundige
Rückfrage-Schleife wiederverwendet) — deshalb dort `ttl: "1h"`.

## TTL: 5m vs. 1h

- **5m (Default):** Write-Aufschlag 1,25×. Break-even ab dem 2. Aufruf.
- **1h:** Write-Aufschlag 2×. Lohnt ab ~3 Aufrufen und nur, wenn zwischen den
  Aufrufen Pausen > 5 min liegen (mehrrundiger Intake/Assistent).

In `kiJson`: Option `ttl: "1h"`. In `ki-intake` fest auf `1h`.

## Verifikation

```
npx tsx scripts/test-prompt-caching.ts   # ANTHROPIC_API_KEY nötig
```

5 Fälle beweisen: großer Prefix → `cache_read > 0` ab Aufruf 2; kleiner Prefix
(< Minimum) → still kein Cache; 1h-TTL; Haiku < 4096; Opus > 512.

## Monitoring

`kiCacheStats(seitTagen)` aggregiert `admin.ki_usage` zu Trefferquote und grober
EUR-Ersparnis (Reads ~0,1× Input, minus Write-Aufschlag). Karte unter
`/assistent`. **0 % trotz `cache_control`** = Prefix unter Minimum oder stiller
Invalidator im Prompt.

## Kosten-/Wirkungsbericht (Stand Umsetzung)

Messung vor der Umsetzung (`admin.ki_usage`): über alle Aufrufe
`cache_read = 0, cache_write = 0` — Caching war **wirkungslos**, weil alle
aktiven Features System-Prompts unter dem jeweiligen Modell-Minimum hatten
(z. B. `anruf_ergebnis`/Sonnet: ~600 Prompt-Tokens < 1024).

Umgesetzt:

1. `unternehmen_intake` ins zentrale Logging geholt (war unsichtbar) + `1h`-TTL —
   das einzige Feature mit großem, real cachebarem Prefix.
2. `MIN_CACHE_TOKENS` + Dev-Warnung: stille Nicht-Treffer werden beim Entwickeln
   sofort sichtbar, statt „Caching an, wirkt aber nicht".
3. `ttl`-Option in `kiJson` für künftige Features mit großem Kontext.
4. Monitoring (`kiCacheStats`) + `/assistent`-Karte als Dauer-Kontrolle der
   Trefferquote.

Erwartung: `unternehmen_intake` in Runde 2+ liest den ~1–2k-Token-Prefix aus dem
Cache (~0,1× statt 1×). Für die kurzen Haiku-Features bleibt `cached()` der
wirksame Hebel — bewusst dokumentiert, nicht „behoben".
