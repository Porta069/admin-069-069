import "server-only";
import { extractProfile } from "./profile";
import { labelFuer } from "./catalog";

/**
 * Bereitet das Handwerker-Registrierungsprofil (User.profileData) für die
 * lesbare Anzeige im Dashboard auf — Slugs werden über den Matching-Katalog in
 * Klartext-Labels übersetzt. Serverseitig, damit dieselbe Quelle wie die Engine
 * genutzt wird.
 */

export interface ProfilFeld {
  label: string;
  wert: string;
}
export interface ProfilAnzeige {
  felder: ProfilFeld[];
  aufgaben: string[];
  prioritaeten: string[];
  arbeitsorte: { label: string; radiusKm: number }[];
  leer: boolean;
}

export function profilAnzeige(profileData: unknown): ProfilAnzeige {
  const { profil, workLocations } = extractProfile(profileData);
  const felder: ProfilFeld[] = [];
  const add = (label: string, art: string, v: string | null) => {
    if (v) felder.push({ label, wert: labelFuer(art, v) });
  };
  add("Gewerk", "bereich", profil.bereich);
  add("Beruf", "beruf", profil.beruf);
  add("Ausbildung", "ausbildung", profil.ausbildungsstatus);
  add("Erfahrung", "erfahrung", profil.erfahrung);
  add("Führerschein", "fuehrerschein", profil.fuehrerschein);
  add("Deutsch", "deutsch", profil.deutsch);
  add("Montagebereitschaft", "montage", profil.montage);
  add("Frühester Start", "start", profil.start);

  const aufgaben = profil.aufgaben.map((a) => labelFuer("aufgabe", a));
  const prioritaeten = profil.prioritaeten.map((p) => labelFuer("prio", p));
  const arbeitsorte = workLocations.map((w) => ({
    label: w.label,
    radiusKm: w.radiusKm,
  }));

  return {
    felder,
    aufgaben,
    prioritaeten,
    arbeitsorte,
    leer:
      felder.length === 0 &&
      aufgaben.length === 0 &&
      prioritaeten.length === 0 &&
      arbeitsorte.length === 0,
  };
}

/** Beruf- bzw. Bereichs-Slug → Klartext (für Listen/Kopfzeilen). */
export function professionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const beruf = labelFuer("beruf", value);
  if (beruf !== value) return beruf;
  const bereich = labelFuer("bereich", value);
  return bereich !== value ? bereich : value;
}
