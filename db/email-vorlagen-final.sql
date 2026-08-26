-- Vollständige Integration der neuen Werkpair-E-Mail-Vorlagen (aus dem Ordner
-- "Email Vorlagen"). Jede Mail = eigener Event/Eintrag, sauber kategorisiert.
-- NUR ergänzend: INSERT … ON CONFLICT (event) DO NOTHING. Bestehende Vorlagen
-- (inkl. der 6 "Vermittlung"-Kandidatenmails) bleiben unangetastet; die 4
-- Ordner-Dubletten davon werden bewusst NICHT eingefügt.

insert into admin.benachrichtigung_vorlage
  (event, name, kategorie, titel, betreff, einleitung, schluss, hervorhebung, variante, variablen, enabled)
values
-- ── Vermittlung (Kandidaten-Lifecycle) ──────────────────────────────────────
('lifecycle.profil_nudge','Profil vervollständigen','Vermittlung',
 $t$Zeig den Betrieben, was du kannst$t$,
 $t$Ein Schritt fehlt noch zu deinen ersten Angeboten$t$,
 $t$Hallo {{vorname}}, Betriebe achten vor allem auf dein Gewerk, deine Erfahrung und deinen Ort. Ergänze kurz die letzten Angaben — dann schalten wir dein Profil für passende Betriebe frei. 2 Minuten, die sich lohnen.$t$,
 $t$Danach heißt es: zurücklehnen — die Betriebe kommen zu dir.
Dein Werkpair-Team$t$,
 $t$Jetzt vervollständigen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"link","label":"Profil-Link","beispiel":"https://werkpair.de/profil"}]$j$::jsonb,true),

('lifecycle.reaktivierung','Reaktivierung','Vermittlung',
 $t$Da tut sich was für dich$t$,
 $t$Neue Betriebe suchen {{gewerk}} in {{ort}}$t$,
 $t$Hallo {{vorname}}, in den letzten Wochen sind neue Betriebe dazugekommen, die genau nach deinem Profil suchen. Ein kurzer Blick lohnt sich — vielleicht ist dein nächster Job schon dabei.$t$,
 $t$Wir haben dich nicht vergessen.
Dein Werkpair-Team$t$,
 $t$Angebote ansehen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"gewerk","label":"Gewerk","beispiel":"Elektroniker"},{"key":"ort","label":"Ort","beispiel":"Heilbronn"},{"key":"link","label":"Angebote-Link","beispiel":"https://werkpair.de/angebote"}]$j$::jsonb,true),

-- ── Betriebe (Unternehmens-Mails) ───────────────────────────────────────────
('betrieb.willkommen','Willkommen / Onboarding (Betrieb)','Betriebe',
 $t$Schluss mit endlosem Suchen$t$,
 $t$Willkommen bei Werkpair — ab jetzt bewerben sich Handwerker bei dir$t$,
 $t$Willkommen, {{firma}}! Bei Werkpair drehen wir den Spieß um: Wir schlagen dir vorqualifizierte Handwerker aus deiner Region vor — du entscheidest, wen du kennenlernen willst.

Leg jetzt deine erste Stelle an und beschreibe, wen du suchst.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Stelle anlegen
{{link}}$t$,'brief',
 $j$[{"key":"firma","label":"Betrieb","beispiel":"Elektro Huber GmbH"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/stelle-anlegen"}]$j$::jsonb,true),

('betrieb.neue_kandidaten','Neue passende Handwerker','Betriebe',
 $t$Diese Profile passen zu dir$t$,
 $t${{anzahl}} passende Handwerker für {{stelle}}$t$,
 $t$Hallo {{vorname}}, für deine Stelle {{stelle}} in {{ort}} haben wir {{anzahl}} passende Handwerker gefunden. Sieh dir die Profile an und sag uns, wen du kennenlernen möchtest — um den Termin kümmern wir uns.$t$,
 $t$Frisch für dich vorausgewählt.
Dein Werkpair-Team$t$,
 $t$Kandidaten ansehen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Ansprechpartner","beispiel":"Sabine"},{"key":"anzahl","label":"Anzahl","beispiel":"3"},{"key":"stelle","label":"Stelle","beispiel":"Elektroniker (m/w/d)"},{"key":"ort","label":"Ort","beispiel":"Heilbronn"},{"key":"link","label":"Kandidaten-Link","beispiel":"https://werkpair.de/kandidaten"}]$j$::jsonb,true),

('betrieb.termin','Kennenlern-Termin bestätigt (Betrieb)','Betriebe',
 $t$Euer Kennenlernen steht$t$,
 $t$Termin mit {{vorname}} bestätigt$t$,
 $t$Dein Kennenlern-Termin mit {{vorname}} ({{gewerk}}) ist bestätigt: am {{termin_datum}} um {{termin_uhrzeit}}. Alle Profildaten findest du im Portal.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Kandidatenprofil öffnen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Kandidat","beispiel":"Max"},{"key":"gewerk","label":"Gewerk","beispiel":"Elektroniker"},{"key":"termin_datum","label":"Datum","beispiel":"12.09.2026"},{"key":"termin_uhrzeit","label":"Uhrzeit","beispiel":"14:00 Uhr"},{"key":"link","label":"Profil-Link","beispiel":"https://werkpair.de/kandidat/123"}]$j$::jsonb,true),

('betrieb.vermittlung_erfolgreich','Vermittlung erfolgreich','Betriebe',
 $t$Geschafft 🎉$t$,
 $t${{vorname}} ist an Bord — herzlichen Glückwunsch!$t$,
 $t${{vorname}} verstärkt ab sofort dein Team — schön, dass es gepasst hat. Deine Rechnung erhältst du separat.

Und wenn du weitere Verstärkung brauchst — wir sind schon dran.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Nächste Stelle anlegen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Kandidat","beispiel":"Max"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/stelle-anlegen"}]$j$::jsonb,true),

('betrieb.angebot','Angebot / Vertrag','Betriebe',
 $t$Dein persönliches Angebot$t$,
 $t$Dein Angebot von Werkpair$t$,
 $t$Wie besprochen findest du hier dein Angebot für die Zusammenarbeit mit Werkpair.

Alles Wichtige auf einen Blick — bei Fragen melde dich gern.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Angebot öffnen
{{link}}$t$,'brief',
 $j$[{"key":"link","label":"Angebots-Link","beispiel":"https://werkpair.de/angebot"}]$j$::jsonb,true),

-- ── Abrechnung ──────────────────────────────────────────────────────────────
('abrechnung.rechnung','Rechnung / Beleg','Abrechnung',
 $t$Rechnung {{rechnungsnummer}}$t$,
 $t$Deine Rechnung {{rechnungsnummer}} von Werkpair$t$,
 $t$Anbei deine Rechnung über {{betrag}}, fällig am {{faellig_am}}. Die Rechnung findest du als PDF im Anhang und jederzeit in deinem Portal.

Bei Fragen sind wir unter {{support_email}} für dich da.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Rechnung ansehen
{{link}}$t$,'brief',
 $j$[{"key":"rechnungsnummer","label":"Rechnungsnummer","beispiel":"WP-2026-0142"},{"key":"betrag","label":"Betrag","beispiel":"1.190,00 €"},{"key":"faellig_am","label":"Fällig am","beispiel":"15.09.2026"},{"key":"support_email","label":"Support","beispiel":"hallo@werkpair.de"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/rechnung/142"}]$j$::jsonb,true),

('abrechnung.zahlungserinnerung','Zahlungserinnerung','Abrechnung',
 $t$Nur eine freundliche Erinnerung$t$,
 $t$Kleine Erinnerung: Rechnung {{rechnungsnummer}}$t$,
 $t$Hallo {{vorname}}, die Rechnung {{rechnungsnummer}} über {{betrag}} ist noch offen (fällig war der {{faellig_am}}). Falls schon überwiesen — danke, dann ignoriere diese Mail einfach.$t$,
 $t$Bei Fragen sind wir jederzeit für dich da.
Dein Werkpair-Team$t$,
 $t$Jetzt begleichen
{{link}}$t$,'brief',
 $j$[{"key":"vorname","label":"Ansprechpartner","beispiel":"Sabine"},{"key":"rechnungsnummer","label":"Rechnungsnummer","beispiel":"WP-2026-0142"},{"key":"betrag","label":"Betrag","beispiel":"1.190,00 €"},{"key":"faellig_am","label":"Fällig am","beispiel":"15.09.2026"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/rechnung/142"}]$j$::jsonb,true),

-- ── Sicherheit ──────────────────────────────────────────────────────────────
('sicherheit.login_hinweis','Sicherheitshinweis / neue Anmeldung','Sicherheit',
 $t$Neuer Login erkannt$t$,
 $t$Neue Anmeldung bei deinem Konto$t$,
 $t$Gerade wurde dein Werkpair-Konto von einem neuen Gerät aus angemeldet.

Warst du das? Alles gut. Falls nicht, ändere bitte sofort dein Passwort.$t$,
 $t$Deine Sicherheit ist uns wichtig.
Dein Werkpair-Team$t$,
 $t$Konto absichern
{{link}}$t$,'zentriert',
 $j$[{"key":"link","label":"Sicherheits-Link","beispiel":"https://werkpair.de/konto"}]$j$::jsonb,true),

('sicherheit.zugangsdaten','Zugangsdaten (neues Konto)','Sicherheit',
 $t$Willkommen im Team$t$,
 $t$Dein Werkpair-Zugang ist da$t$,
 $t$Für dich wurde ein Werkpair-Konto angelegt. Melde dich mit dieser E-Mail und dem Start-Passwort {{code}} an — beim ersten Login legst du dein eigenes Passwort fest.$t$,
 $t$Bis bald im Handwerk,
Dein Werkpair-Team$t$,
 $t$Jetzt anmelden
{{link}}$t$,'zentriert',
 $j$[{"key":"code","label":"Start-Passwort","beispiel":"WP-x8k2m9"},{"key":"link","label":"Login-Link","beispiel":"https://werkpair.de/login"}]$j$::jsonb,true),

-- ── Marketing ───────────────────────────────────────────────────────────────
('marketing.produkt_update','Produkt-Update','Marketing',
 $t${{feature_titel}}$t$,
 $t$Neu bei Werkpair: {{feature_titel}}$t$,
 $t$Hallo {{vorname}}, wir haben etwas gebaut, das dir Zeit spart: {{feature_titel}}. Probier es aus und sag uns, wie du es findest.$t$,
 $t$Kurz erklärt, warum es dir hilft.
Dein Werkpair-Team$t$,
 $t$Ansehen
{{link}}$t$,'zentriert',
 $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"feature_titel","label":"Feature","beispiel":"Terminvorschläge per Klick"},{"key":"link","label":"Feature-Link","beispiel":"https://werkpair.de/neu"}]$j$::jsonb,true),

('marketing.feedback','Feedback erbitten','Marketing',
 $t$Wie läuft es bei dir?$t$,
 $t$30 Sekunden für ehrliches Feedback?$t$,
 $t$Hallo {{vorname}}, wir wollen Werkpair Tag für Tag besser machen — dafür brauchen wir dich. Erzähl uns kurz, was gut läuft und was nicht.$t$,
 $t$Deine Meinung macht Werkpair besser.
Dein Werkpair-Team$t$,
 $t$Feedback geben
{{link}}$t$,'zentriert',
 $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"link","label":"Feedback-Link","beispiel":"https://werkpair.de/feedback"}]$j$::jsonb,true)
on conflict (event) do nothing;
