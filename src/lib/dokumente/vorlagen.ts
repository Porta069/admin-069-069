import type { FeldDef, FeldWerte } from "./typen";
import { SENDER_DEFAULT, BRIEF_FELDER } from "./felder";

/**
 * Registry fertiger PDF-Dokumentvorlagen (Schreiben ohne Positionen). Jede
 * Vorlage liefert vorbelegte Feldwerte mit sauberem deutschem Fließtext; der
 * Empfänger bleibt leer und wird pro Versand ausgefüllt. Datumsfelder sind
 * reiner Text (kein Datumsformat) — der Nutzer trägt z. B. „14.09.2026" ein.
 */
export interface DokumentVorlage {
  key: string;
  name: string;
  beschreibung: string;
  kategorie: string;
  mitPositionen?: boolean;
  felder: FeldDef[];
  werte: FeldWerte;
}

/** Baut die Feldwerte einer Brief-Vorlage auf dem Standard-Absender auf. */
function brief(werte: {
  titel: string;
  betreff: string;
  einleitung: string;
  schluss: string;
  nummer?: string;
}): FeldWerte {
  return {
    ...SENDER_DEFAULT,
    empfaengerName: "",
    empfaengerAdresse: "",
    titel: werte.titel,
    nummer: werte.nummer ?? "",
    datum: "",
    betreff: werte.betreff,
    einleitung: werte.einleitung,
    schluss: werte.schluss,
  };
}

export const DOKUMENT_VORLAGEN: DokumentVorlage[] = [
  {
    key: "agb_update",
    name: "Aktualisierung der Nutzungsbedingungen (AGB)",
    beschreibung:
      "Kunden über geänderte Allgemeine Geschäftsbedingungen informieren, inklusive Wirksamkeitsdatum und Widerspruchsrecht.",
    kategorie: "Rechtliches",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "Aktualisierung der AGB",
      betreff: "Wichtige Änderung unserer Allgemeinen Geschäftsbedingungen",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\nwir haben unsere Allgemeinen Geschäftsbedingungen (AGB) überarbeitet, um sie an aktuelle rechtliche Vorgaben anzupassen und unsere Leistungen für Sie noch verständlicher zu beschreiben. Die aktualisierte Fassung tritt zum [Datum eintragen] in Kraft und gilt ab diesem Zeitpunkt für die weitere Nutzung unserer Dienste.\n\nDie wesentlichen Änderungen betreffen [kurz zusammenfassen, z. B. Vertragslaufzeiten, Zahlungsbedingungen, Haftungsregelungen]. Die vollständige neue Fassung können Sie jederzeit unter www.portawerk.de/agb einsehen.\n\nSie haben das Recht, den geänderten Bedingungen bis zum Tag vor ihrem Inkrafttreten zu widersprechen. Widersprechen Sie nicht und nutzen Sie unsere Leistungen weiter, gelten die neuen AGB als von Ihnen angenommen.",
      schluss:
        "Bei Fragen zu den Änderungen erreichen Sie uns unter rechnung@portawerk.de oder telefonisch während unserer Geschäftszeiten. Wir beantworten Ihre Anliegen gerne.\n\nMit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
  {
    key: "datenschutz_update",
    name: "Aktualisierung der Datenschutzerklärung",
    beschreibung:
      "Über eine überarbeitete Datenschutzerklärung informieren, mit Geltungsbeginn und Hinweis auf Betroffenenrechte.",
    kategorie: "Rechtliches",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "Aktualisierung der Datenschutzerklärung",
      betreff: "Aktualisierung unserer Datenschutzerklärung",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\nder Schutz Ihrer personenbezogenen Daten hat für uns hohe Priorität. Wir haben unsere Datenschutzerklärung überarbeitet, um sie transparenter zu gestalten und an die Vorgaben der Datenschutz-Grundverordnung (DSGVO) anzupassen. Die aktualisierte Fassung gilt ab dem [Datum eintragen].\n\nDie Anpassungen betreffen insbesondere [kurz zusammenfassen, z. B. Zwecke der Datenverarbeitung, Speicherdauer, eingesetzte Dienstleister]. Ihre Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung sowie auf Datenübertragbarkeit bleiben selbstverständlich vollständig gewahrt.\n\nDie vollständige Datenschutzerklärung finden Sie jederzeit unter www.portawerk.de/datenschutz.",
      schluss:
        "Wenn Sie Fragen zur Verarbeitung Ihrer Daten haben oder von Ihren Betroffenenrechten Gebrauch machen möchten, wenden Sie sich bitte an datenschutz@portawerk.de.\n\nMit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
  {
    key: "wichtige_info",
    name: "Wichtige Information",
    beschreibung:
      "Allgemeine Ankündigung an Kandidaten, Unternehmen oder Partner — für Neuigkeiten, Änderungen oder Hinweise.",
    kategorie: "Kommunikation",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "Wichtige Information",
      betreff: "Wichtige Information für Sie",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\nwir möchten Sie über eine wichtige Neuerung informieren: [hier den Kern der Mitteilung eintragen].\n\nWas das für Sie bedeutet: [Auswirkungen und nächste Schritte beschreiben]. Ab wann die Änderung gilt: [Datum eintragen].\n\nBitte beachten Sie diese Information für die weitere Zusammenarbeit mit uns. Sollten Sie tätig werden müssen, haben wir dies oben deutlich gekennzeichnet.",
      schluss:
        "Bei Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung. Sie erreichen uns unter rechnung@portawerk.de.\n\nMit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
  {
    key: "willkommen",
    name: "Willkommen bei PORTAWERK",
    beschreibung:
      "Persönliches Onboarding-Schreiben für neue Kandidaten oder Partnerunternehmen zum Start der Zusammenarbeit.",
    kategorie: "Kommunikation",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "Herzlich willkommen",
      betreff: "Willkommen bei PORTAWERK — schön, dass Sie dabei sind",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\nherzlich willkommen bei PORTAWERK! Wir freuen uns sehr, Sie als Teil unseres Netzwerks begrüßen zu dürfen, und danken Ihnen für Ihr Vertrauen.\n\nAls Ihr Partner in der Personalvermittlung begleiten wir Sie ab sofort persönlich: Wir hören zu, verstehen Ihre Ziele und bringen die passenden Menschen und Chancen zusammen. Ihr fester Ansprechpartner meldet sich in den kommenden Tagen bei Ihnen, um alle nächsten Schritte in Ruhe mit Ihnen zu besprechen.\n\nDamit Sie direkt starten können, haben wir das Wichtigste für Sie vorbereitet: [z. B. Zugangsdaten, Terminvorschlag, benötigte Unterlagen].",
      schluss:
        "Wenn Sie Fragen haben, erreichen Sie uns jederzeit unter rechnung@portawerk.de. Wir freuen uns auf eine erfolgreiche Zusammenarbeit.\n\nMit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
  {
    key: "anschreiben",
    name: "Allgemeines Anschreiben",
    beschreibung:
      "Weitgehend leerer, frei editierbarer Brief mit Standard-Absender — für individuelle Schreiben aller Art.",
    kategorie: "Kommunikation",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "",
      betreff: "",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\n[Ihr Text.]",
      schluss: "Mit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
  {
    key: "terminbestaetigung",
    name: "Terminbestätigung",
    beschreibung:
      "Einen vereinbarten Termin schriftlich bestätigen — mit Datum, Uhrzeit, Ort und Ansprechpartner.",
    kategorie: "Kommunikation",
    felder: BRIEF_FELDER,
    werte: brief({
      titel: "Terminbestätigung",
      betreff: "Bestätigung Ihres Termins",
      einleitung:
        "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Terminvereinbarung. Hiermit bestätigen wir Ihnen den folgenden Termin verbindlich:\n\nDatum: [Datum eintragen]\nUhrzeit: [Uhrzeit eintragen]\nOrt: [Ort oder Videolink eintragen]\nAnsprechpartner: [Name eintragen]\n\nBitte bringen Sie zu diesem Termin nach Möglichkeit die folgenden Unterlagen mit: [Unterlagen auflisten].",
      schluss:
        "Sollten Sie den Termin nicht wahrnehmen können, geben Sie uns bitte rechtzeitig Bescheid, damit wir gemeinsam einen neuen Zeitpunkt finden. Sie erreichen uns unter rechnung@portawerk.de.\n\nMit freundlichen Grüßen\nIhr PORTAWERK-Team",
    }),
  },
];

/** Vorlage per Key nachschlagen (undefined bei unbekanntem Key). */
export function vorlageFuer(key: string): DokumentVorlage | undefined {
  return DOKUMENT_VORLAGEN.find((v) => v.key === key);
}
