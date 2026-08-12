import "server-only";
import {
  katalog as statischerKatalog,
  type Bereich,
  type KatalogOption,
  type RangOption,
} from "./catalog";

/**
 * Live-Fachkatalog vom Backend (GET /catalog) — stündlich revalidiert.
 * Die lokale Kopie in ./catalog.ts dient NUR als Rückfallebene; wenn sie
 * greift, meldet `quelle: "fallback"` das sichtbar an die Oberfläche.
 */

export interface KatalogDaten {
  bereiche: Bereich[];
  ausbildungsstatus: RangOption[];
  erfahrung: RangOption[];
  prioritaeten: KatalogOption[];
  prioritaetenMax: number;
  montage: RangOption[];
  fuehrerschein: RangOption[];
  deutsch: RangOption[];
  start: RangOption[];
}

export interface KatalogErgebnis {
  katalog: KatalogDaten;
  quelle: "live" | "fallback";
}

const BASE =
  process.env.BACKEND_URL ?? "https://portbackend-069-069.onrender.com/api/v1";

export async function getKatalog(): Promise<KatalogErgebnis> {
  try {
    const res = await fetch(`${BASE}/catalog`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = (await res.json()) as Partial<KatalogDaten>;
    if (!Array.isArray(data.bereiche) || data.bereiche.length === 0) {
      throw new Error("catalog: leere Antwort");
    }
    const fallback = statischerKatalog();
    return {
      katalog: {
        bereiche: data.bereiche,
        ausbildungsstatus: data.ausbildungsstatus ?? fallback.ausbildungsstatus,
        erfahrung: data.erfahrung ?? fallback.erfahrung,
        prioritaeten: data.prioritaeten ?? fallback.prioritaeten,
        prioritaetenMax: data.prioritaetenMax ?? fallback.prioritaetenMax,
        montage: data.montage ?? fallback.montage,
        fuehrerschein: data.fuehrerschein ?? fallback.fuehrerschein,
        deutsch: data.deutsch ?? fallback.deutsch,
        start: data.start ?? fallback.start,
      },
      quelle: "live",
    };
  } catch (err) {
    console.error("Katalog-Fetch fehlgeschlagen — lokale Rückfallebene aktiv", err);
    return { katalog: statischerKatalog(), quelle: "fallback" };
  }
}
