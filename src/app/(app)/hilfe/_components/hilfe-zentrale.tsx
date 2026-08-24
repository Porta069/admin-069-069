"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight } from "lucide-react";

interface Thema {
  titel: string;
  text: string;
  href?: string;
  neu?: boolean;
}
interface Gruppe {
  titel: string;
  themen: Thema[];
}

const INHALT: Gruppe[] = [
  {
    titel: "Überblick & Navigation",
    themen: [
      {
        titel: "Mein Cockpit",
        neu: true,
        href: "/cockpit",
        text: "Deine persönliche Startseite: deine offenen Aufgaben (überfällige zuerst), die Kandidaten, die du zuerst anrufen solltest, und deine aktive Pipeline je Status auf einen Blick — statt fünf Seiten durchzuklicken.",
      },
      {
        titel: "Dashboard",
        href: "/",
        text: "Team-weite Kennzahlen und Aktivität. Widgets lassen sich anpassen.",
      },
      {
        titel: "Command-Palette (⌘K / Strg+K)",
        neu: true,
        text: "Oben die Suchleiste oder ⌘K öffnet die Schaltzentrale: nach Kandidaten/Firmen/Stellen suchen, zu JEDER erlaubten Seite springen oder eine Schnell-Aktion ausführen — alles per Tastatur.",
      },
    ],
  },
  {
    titel: "Kandidaten & Status",
    themen: [
      {
        titel: "Der eine Kandidaten-Status",
        text: "Jeder Kandidat hat genau EINEN Status: Neu-Registrierung → Angerufen → Sucht Matching → In Vermittlung → Bewerbung → Angenommen, plus die Abzweige Kein Interesse / Abgelehnt / Inaktiv. Priorität ist getrennt davon.",
        href: "/kandidaten",
      },
      {
        titel: "Automatische Status-Wechsel",
        text: "Registrierung → „Neu-Registrierung“; nach dem Telefonat → „Angerufen“; Job-Zuordnung/Vorschlag → „In Vermittlung“. Manuelle Wechsel werden nie automatisch zurückgestuft. „Inaktiv“ wird nie automatisch gesetzt.",
      },
      {
        titel: "KI-Kurzzusammenfassung",
        neu: true,
        text: "Auf der Kandidaten-Detailseite fasst der Button „KI-Zusammenfassung“ die Historie (Status, Notizen, Anrufe, Kommunikation) zu „Stand & nächster Schritt“ zusammen — nur auf Knopfdruck, nicht automatisch.",
      },
      {
        titel: "Kandidaten-Suche & Reaktivierung",
        text: "Gezielt nach Kriterien suchen; „Reaktivierung“ listet lange inaktive Kandidaten, die wieder Aufmerksamkeit brauchen.",
        href: "/kandidaten-suche",
      },
    ],
  },
  {
    titel: "Call Center",
    themen: [
      {
        titel: "Smarte Anruf-Warteschlange",
        neu: true,
        href: "/callcenter",
        text: "Die Reihenfolge ist priorisiert: überfällig zuerst, dann dringend/hoch, dann Rückrufe, dann nach Fälligkeit und Alter. So bekommst du immer den nächstbesten Anruf serviert.",
      },
      {
        titel: "Anruf-Interface",
        text: "3 KI-gestützte Fragen, Top-Job-Match live, und das Ergebnis (Rückruf / Termin / Vermittlung / kein Interesse) setzt automatisch den passenden Status.",
      },
    ],
  },
  {
    titel: "Matching & Vermittlung",
    themen: [
      {
        titel: "Matching-Center",
        href: "/matching",
        text: "Die Engine bewertet in zwei Stufen: erst harte Ausschlüsse, dann eine gewichtete Punktwertung — vollständig offengelegt.",
      },
      {
        titel: "Radar & Vorschläge",
        href: "/radar",
        text: "Der Radar erkennt automatisch starke Matches; im Vorschläge-Bereich werden sie in Angebote überführt. Ein Vorschlag setzt den Kandidaten automatisch auf „In Vermittlung“.",
      },
      {
        titel: "Vermittlungen & Prämien",
        href: "/vermittlungen",
        text: "Erfolgreiche Vermittlungen mit 8-Wochen-Treueprämie und Affiliate-Bonus; das Prämien-Register bündelt alle Auszahlungen.",
      },
    ],
  },
  {
    titel: "Mitarbeiter & Zuweisung",
    themen: [
      {
        titel: "Zuständigkeitsverteilung",
        href: "/mitarbeiter/verteilung",
        text: "Board mit getrennten Ansichten für Nutzer und Unternehmen. Per Drag & Drop (oder Verschieben-Menü) Personen zwischen Mitarbeitern umziehen — die Zuständigkeit ändert sich sofort.",
      },
      {
        titel: "Automatische Zuweisung (Routing)",
        neu: true,
        href: "/mitarbeiter/einstellungen",
        text: "In den Mitarbeiter-Einstellungen wählst du EINEN Modus: „Kompletter Flow“ (ein Mitarbeiter betreut alles; neue Kandidaten werden reihum verteilt) ODER „Flow-Aufteilung“ (je Schritt ein Mitarbeiter — z. B. A telefoniert, danach ist automatisch B zuständig).",
      },
      {
        titel: "Mitarbeiter-Cockpit & Präsenz",
        href: "/mitarbeiter",
        text: "Pro Mitarbeiter: Vermittlungen, Umsatz, Anrufe, offene Aufgaben. Präsenz-Punkt am Avatar (online / abwesend / Urlaub / im Call).",
      },
      {
        titel: "Rollen, Rechte & 2FA",
        href: "/mitarbeiter",
        text: "Berechtigungen über Rollen-Templates, individuell anpassbar. 2FA ist Pflicht; neue Accounts bekommen ein generiertes Passwort zum Übermitteln.",
      },
    ],
  },
  {
    titel: "Kommunikation",
    themen: [
      {
        titel: "Mitteilungszentrale",
        href: "/benachrichtigungen",
        text: "Drei Kategorien (System / Benachrichtigungen / Persönlich). Jede Mitteilung bleibt, bis du sie „wahrnimmst“ — dann verschwindet sie mit 30-Sekunden-Rückgängig und wird danach gelöscht (der Fakt bleibt).",
      },
      {
        titel: "Persönliche Mitteilungen + Tagging",
        text: "Nachrichten an Kollegen senden und Nutzer/Unternehmen taggen. Getaggte erscheinen zusätzlich in deren Kommunikations-Historie.",
      },
      {
        titel: "Belege, Vorlagen & autonomer Versand",
        href: "/belege",
        text: "Ereignis-E-Mail-Vorlagen mit Vorschau. Der autonome Versand ist per Master-Schalter standardmäßig AUS — erst einschalten, wenn geklärt ist, welche Mails die Plattform selbst sendet.",
      },
    ],
  },
  {
    titel: "Auswertung & Datenqualität",
    themen: [
      {
        titel: "Analytics",
        neu: true,
        href: "/analytics",
        text: "Kennzahlen, Pipeline-Durchlauf (Verweildauer), Status-Verteilung im Ablauf und Match-Score → Vermittlungsquote (zeigt, ob hohe Scores wirklich konvertieren).",
      },
      {
        titel: "Datenqualität",
        href: "/datenqualitaet",
        text: "Findet Lücken und Dubletten: Kandidaten ohne Profil/Zuständige, verwaiste Betriebe, doppelte Kandidaten (E-Mail/Name/Telefon) — mit Direkt-Aktionen zur Bereinigung.",
      },
    ],
  },
  {
    titel: "Sicherheit & Werkzeuge",
    themen: [
      {
        titel: "Temp-Lock (Bildschirmsperre)",
        neu: true,
        text: "Der Button oben rechts sperrt den Bildschirm mit einer animierten Screensaver-Fläche. Zum Zurückkehren muss der Code eingegeben werden — Sichtschutz beim kurzen Weggehen.",
      },
      {
        titel: "Präsenz-Status",
        text: "Über den Umschalter oben rechts: Verfügbar / Abwesend / Im Urlaub. „Im Call“ wird automatisch gesetzt, wenn du einen Anruf startest.",
      },
      {
        titel: "KI-Assistent & Automatisierungen",
        href: "/assistent",
        text: "Fragen zum System, Texte entwerfen; Automatisierungen und der SLA-Wächter erzeugen Nachfass-Aufgaben, wenn Kandidaten zu lange in einem Status hängen.",
      },
    ],
  },
];

export function HilfeZentrale() {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();

  const gefiltert = INHALT.map((g) => ({
    ...g,
    themen: query
      ? g.themen.filter(
          (t) =>
            t.titel.toLowerCase().includes(query) || t.text.toLowerCase().includes(query),
        )
      : g.themen,
  })).filter((g) => g.themen.length > 0);

  return (
    <div className="max-w-3xl">
      <div className="relative mb-6">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Funktion suchen… (z. B. Status, Anruf, Temp-Lock)"
          className="pl-9"
        />
      </div>

      {gefiltert.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nichts gefunden für „{q}“.
        </p>
      ) : (
        <div className="space-y-8">
          {gefiltert.map((g) => (
            <section key={g.titel}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{g.titel}</h2>
              <div className="space-y-2.5">
                {g.themen.map((t) => (
                  <div key={t.titel} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{t.titel}</h3>
                      {t.neu && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Neu
                        </Badge>
                      )}
                      {t.href && (
                        <Link
                          href={t.href}
                          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Öffnen <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
