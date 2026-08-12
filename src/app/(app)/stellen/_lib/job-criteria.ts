/**
 * Matching-Vokabular der Plattform (Spiegel von GET /catalog des Render-Backends,
 * Stand der Werte in public."JobPosting" / User.profileData). Reine Daten —
 * server- und clientseitig nutzbar.
 */

export interface LevelOption {
  value: string;
  label: string;
}

// ── Bereiche (Gewerke) ─────────────────────────────────────────────────────

export const BEREICH_OPTIONS: LevelOption[] = [
  { value: "elektronik", label: "Elektronik" },
  { value: "shk", label: "Anlagenmechanik SHK" },
  { value: "heizung_lueftung", label: "Heizungs- & Lüftungsbau" },
  { value: "maler", label: "Maler & Lackierer" },
  { value: "tischler", label: "Tischler / Schreiner" },
  { value: "maurer", label: "Maurer / Betonbauer" },
  { value: "dachdecker", label: "Dachdecker" },
  { value: "fliesenleger", label: "Fliesenleger" },
  { value: "zimmerer", label: "Zimmerer" },
  { value: "metallbau", label: "Metallbauer / Schlosser" },
  { value: "kfz", label: "KFZ-Mechatronik" },
  { value: "trockenbau", label: "Trockenbauer" },
  { value: "geruestbau", label: "Gerüstbauer" },
  { value: "galabau", label: "Garten- & Landschaftsbau" },
  { value: "sonstiges", label: "Anderes Gewerk" },
];

// ── Berufe (Katalog-Slugs → deutsche Labels) ───────────────────────────────

export const BERUF_LABELS: Record<string, string> = {
  elektroniker_energie_gebaeude: "Elektroniker für Energie- und Gebäudetechnik",
  elektroinstallateur: "Elektroinstallateur",
  elektroniker_betriebstechnik: "Elektroniker für Betriebstechnik",
  energieanlagenelektroniker: "Energieanlagenelektroniker",
  elektroniker_geraete_systeme: "Elektroniker für Geräte und Systeme",
  mechatroniker: "Mechatroniker",
  industrieelektroniker: "Industrieelektroniker",
  elektroniker_maschinen_antriebe: "Elektroniker für Maschinen- und Antriebstechnik",
  elektroniker_information_tk:
    "Elektroniker für Informations- und Telekommunikationstechnik",
  elektroniker_automatisierung: "Elektroniker für Automatisierungstechnik",
  industriemechaniker: "Industriemechaniker",
  werkzeugmechaniker: "Werkzeugmechaniker",
  kfz_mechatroniker: "KFZ-Mechatroniker",
  sonstiges_elektrotechnik: "Sonstiges Elektrotechnik",
  anlagenmechaniker_shk: "Anlagenmechaniker für Sanitär-, Heizungs- und Klimatechnik",
  gas_wasserinstallateur: "Gas- und Wasserinstallateur",
  zentralheizungs_lueftungsbauer: "Zentralheizungs- und Lüftungsbauer",
  klempner: "Klempner / Spengler",
  kaelteanlagenbauer: "Mechatroniker für Kältetechnik / Kälteanlagenbauer",
  ofen_luftheizungsbauer: "Ofen- und Luftheizungsbauer",
  rohrleitungsbauer: "Rohrleitungsbauer",
  behaelter_apparatebauer: "Behälter- und Apparatebauer",
  sonstiges_shk: "Sonstiges SHK",
  sonstiges_heizung_lueftung: "Sonstiges Heizung / Lüftung",
  maler_lackierer: "Maler und Lackierer",
  bauten_objektbeschichter: "Bauten- und Objektbeschichter",
  fahrzeuglackierer: "Fahrzeuglackierer",
  stuckateur: "Stuckateur",
  sonstiges_maler: "Sonstiges Maler / Lackierer",
  tischler_schreiner: "Tischler / Schreiner",
  holzmechaniker: "Holzmechaniker",
  fachkraft_moebel_kuechen: "Fachkraft für Möbel-, Küchen- und Umzugsservice",
  sonstiges_tischler: "Sonstiges Holz / Möbel",
  maurer: "Maurer",
  beton_stahlbetonbauer: "Beton- und Stahlbetonbauer",
  bauwerksmechaniker_abbruch: "Bauwerksmechaniker für Abbruchtechnik",
  feuerungs_schornsteinbauer: "Feuerungs- und Schornsteinbauer",
  sonstiges_maurer: "Sonstiges Hochbau",
  dachdecker: "Dachdecker",
  zimmerer: "Zimmerer",
  sonstiges_dach: "Sonstiges Dach",
  fliesen_platten_mosaikleger: "Fliesen-, Platten- und Mosaikleger",
  estrichleger: "Estrichleger",
  sonstiges_fliesen: "Sonstiges Fliesen / Estrich",
  holzbau_techniker: "Techniker / Meister Holzbau",
  sonstiges_zimmerer: "Sonstiges Holzbau",
  metallbauer_konstruktion: "Metallbauer Konstruktionstechnik",
  metallbauer_nutzfahrzeuge: "Metallbauer Nutzfahrzeugbau",
  konstruktionsmechaniker: "Konstruktionsmechaniker",
  schweisser: "Schweißer (mit Prüfung)",
  sonstiges_metall: "Sonstiges Metall",
  kfz_mechatroniker_pkw: "Kfz-Mechatroniker PKW",
  kfz_mechatroniker_nfz: "Kfz-Mechatroniker Nutzfahrzeuge",
  kfz_mechatroniker_system_hv: "Kfz-Mechatroniker System- & Hochvolttechnik",
  karosserie_fahrzeugbaumechaniker: "Karosserie- und Fahrzeugbaumechaniker",
  zweiradmechatroniker: "Zweiradmechatroniker",
  sonstiges_kfz: "Sonstiges KFZ",
  trockenbaumonteur: "Trockenbaumonteur",
  ausbaufacharbeiter: "Ausbaufacharbeiter",
  sonstiges_trockenbau: "Sonstiges Ausbau",
  geruestbauer: "Gerüstbauer",
  sonstiges_geruest: "Sonstiges Gerüstbau",
  landschaftsgaertner: "Landschaftsgärtner (GaLaBau)",
  gaertner: "Gärtner",
  strassenbauer: "Straßenbauer",
  sonstiges_galabau: "Sonstiges GaLaBau",
  sonstige_ausbildung: "Sonstige Ausbildung",
};

// ── Stufen-Vokabulare (rang-aufsteigend, wie im Plattform-Katalog) ─────────

export const ERFAHRUNG_OPTIONS: LevelOption[] = [
  { value: "keine", label: "0 Jahre" },
  { value: "1_2", label: "1 bis 2 Jahre" },
  { value: "3_5", label: "3 bis 5 Jahre" },
  { value: "6_10", label: "6 bis 10 Jahre" },
  { value: "ueber_10", label: "Mehr als 10 Jahre" },
];

export const AUSBILDUNG_OPTIONS: LevelOption[] = [
  { value: "keine", label: "Keine Ausbildung" },
  { value: "in_ausbildung", label: "In Ausbildung" },
  { value: "berufsausbildung", label: "Berufsausbildung" },
  { value: "techniker_meister", label: "Techniker / Meister" },
];

export const DEUTSCH_OPTIONS: LevelOption[] = [
  { value: "keine", label: "Keine Kenntnisse" },
  { value: "grundkenntnisse", label: "Grundkenntnisse" },
  { value: "verhandlungssicher", label: "Verhandlungssicher" },
  { value: "muttersprachlich", label: "Muttersprachlich" },
];

export const FUEHRERSCHEIN_OPTIONS: LevelOption[] = [
  { value: "nein", label: "Nein" },
  { value: "fahrschule", label: "In der Fahrschule" },
  { value: "b", label: "Klasse B (PKW)" },
  { value: "c", label: "Klasse C (LKW, Anhänger, etc.)" },
];

export const MONTAGE_MIN_OPTIONS: LevelOption[] = [
  { value: "nie", label: "Nie" },
  { value: "gering", label: "Gering (1–4 Nächte/Monat)" },
  { value: "regelmaessig", label: "Regelmäßig (5–15 Tage/Monat)" },
  { value: "unbeschraenkt", label: "Unbeschränkt (Mo–Fr auf Montage)" },
];

/** Freitext-Feld JobPosting.montage — bekannte Plattform-Werte. */
export const MONTAGE_TEXT_OPTIONS = [
  "Jeden Abend zuhause",
  "Gelegentlich Montage",
  "Dauermontage",
];

// ── Gewichte ───────────────────────────────────────────────────────────────

/** Feste Kriterienliste für neue Gewichts-Einträge. */
export const WEIGHT_CRITERIA: LevelOption[] = [
  { value: "beruf", label: "Beruf" },
  { value: "bereich", label: "Bereich / Gewerk" },
  { value: "erfahrung", label: "Berufserfahrung" },
  { value: "deutsch", label: "Deutschkenntnisse" },
  { value: "fuehrerschein", label: "Führerschein" },
  { value: "montage", label: "Montagebereitschaft" },
  { value: "entfernung", label: "Entfernung" },
  { value: "ausbildung", label: "Ausbildung" },
];

export const WEIGHT_LABELS: Record<string, string> = {
  ...Object.fromEntries(WEIGHT_CRITERIA.map((c) => [c.value, c.label])),
  berufe: "Beruf",
  bereiche: "Bereich / Gewerk",
  gewerk: "Bereich / Gewerk",
  aufgaben: "Aufgabenbereiche",
  region: "Entfernung",
  verfuegbarkeit: "Verfügbarkeit",
};

// ── Label-Helfer ───────────────────────────────────────────────────────────

/** Fallback: unbekannten Slug lesbar machen ("pv_solar" → "Pv Solar"). */
export function humanizeSlug(slug: string): string {
  return slug
    .split("_")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export function berufLabel(slug: string): string {
  return BERUF_LABELS[slug] ?? humanizeSlug(slug);
}

export function bereichLabel(slug: string): string {
  return BEREICH_OPTIONS.find((o) => o.value === slug)?.label ?? humanizeSlug(slug);
}

export function levelLabel(options: LevelOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? humanizeSlug(value);
}

export function weightLabel(key: string): string {
  return WEIGHT_LABELS[key.toLowerCase()] ?? humanizeSlug(key);
}

// ── Ideal-Profil aus Job-Feldern ableiten ──────────────────────────────────

/** Felder aus public."JobPosting", die fürs Matching relevant sind. */
export interface JobCriteriaFields {
  berufe: string[] | null;
  bereiche: string[] | null;
  aufgaben: string[] | null;
  aufgabenMin: number | null;
  erfahrungMin: string | null;
  erfahrungMax: string | null;
  ausbildungMin: string | null;
  deutschMin: string | null;
  fuehrerscheinMin: string | null;
  montageMin: string | null;
  city: string | null;
  gewichte: Record<string, unknown> | null;
}

export interface IdealProfileRow {
  key: string;
  label: string;
  value: string;
  weight: number | null;
}

function readWeight(
  gewichte: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!gewichte) return null;
  for (const key of keys) {
    const raw = gewichte[key];
    const num = typeof raw === "number" ? raw : Number(raw);
    if (raw != null && Number.isFinite(num)) return num;
  }
  return null;
}

/**
 * Baut die Zeilen des optimalen Kandidatenprofils. Leere Kriterien werden
 * weggelassen; Zeilen sind nach Gewicht absteigend sortiert (ohne Gewicht
 * zuletzt).
 */
export function buildIdealProfile(job: JobCriteriaFields): IdealProfileRow[] {
  const g = job.gewichte ?? null;
  const rows: IdealProfileRow[] = [];

  const berufe = (job.berufe ?? []).filter(Boolean);
  if (berufe.length > 0) {
    rows.push({
      key: "beruf",
      label: "Beruf",
      value: berufe.map(berufLabel).join(", "),
      weight: readWeight(g, "beruf", "berufe"),
    });
  }

  const bereiche = (job.bereiche ?? []).filter(Boolean);
  if (bereiche.length > 0) {
    rows.push({
      key: "bereich",
      label: "Bereich / Gewerk",
      value: bereiche.map(bereichLabel).join(", "),
      weight: readWeight(g, "bereich", "bereiche", "gewerk"),
    });
  }

  const aufgaben = (job.aufgaben ?? []).filter(Boolean);
  if (aufgaben.length > 0) {
    const list = aufgaben.map(humanizeSlug).join(", ");
    rows.push({
      key: "aufgaben",
      label: "Aufgabenbereiche",
      value:
        job.aufgabenMin && job.aufgabenMin > 0
          ? `mind. ${job.aufgabenMin} von: ${list}`
          : list,
      weight: readWeight(g, "aufgaben"),
    });
  }

  if (job.erfahrungMin || job.erfahrungMax) {
    const min = job.erfahrungMin
      ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMin)
      : null;
    const max = job.erfahrungMax
      ? levelLabel(ERFAHRUNG_OPTIONS, job.erfahrungMax)
      : null;
    rows.push({
      key: "erfahrung",
      label: "Berufserfahrung",
      value:
        min && max ? `${min} bis ${max}` : min ? `mind. ${min}` : `bis ${max}`,
      weight: readWeight(g, "erfahrung"),
    });
  }

  if (job.ausbildungMin) {
    rows.push({
      key: "ausbildung",
      label: "Ausbildung",
      value: `mind. ${levelLabel(AUSBILDUNG_OPTIONS, job.ausbildungMin)}`,
      weight: readWeight(g, "ausbildung"),
    });
  }

  if (job.deutschMin) {
    rows.push({
      key: "deutsch",
      label: "Deutschkenntnisse",
      value: `mind. ${levelLabel(DEUTSCH_OPTIONS, job.deutschMin)}`,
      weight: readWeight(g, "deutsch"),
    });
  }

  if (job.fuehrerscheinMin) {
    rows.push({
      key: "fuehrerschein",
      label: "Führerschein",
      value: `mind. ${levelLabel(FUEHRERSCHEIN_OPTIONS, job.fuehrerscheinMin)}`,
      weight: readWeight(g, "fuehrerschein"),
    });
  }

  if (job.montageMin) {
    rows.push({
      key: "montage",
      label: "Montagebereitschaft",
      value: `mind. ${levelLabel(MONTAGE_MIN_OPTIONS, job.montageMin)}`,
      weight: readWeight(g, "montage"),
    });
  }

  if (job.city) {
    rows.push({
      key: "entfernung",
      label: "Entfernung",
      value: `Arbeitsort im Umkreis von ${job.city}`,
      weight: readWeight(g, "entfernung", "region"),
    });
  }

  return rows.sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));
}
