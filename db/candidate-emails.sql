-- Kandidaten-Lifecycle-Mails aus NUTZERSICHT (Prinzip: der Betrieb bewirbt sich
-- beim Handwerker). Gebrandete Werkpair-Event-Vorlagen. Idempotent per event.
insert into admin.benachrichtigung_vorlage
  (event, name, kategorie, titel, betreff, einleitung, schluss, hervorhebung, variante, variablen, enabled)
values
(
  'betrieb_interesse',
  'Ein Betrieb bewirbt sich bei dir',
  'Vermittlung',
  $t$Ein Betrieb bewirbt sich bei dir$t$,
  $t${{firma}} möchte dich für sich gewinnen$t$,
  $t$Hallo {{vorname}},

genau so ist Werkpair gedacht: Du suchst nicht — die Betriebe kommen zu dir. {{firma}} aus {{ort}} sucht {{gewerk}} und hat sich dein Profil angesehen. Der Betrieb würde dich gerne kennenlernen.

Schau dir das Angebot in Ruhe an und entscheide selbst, ob es passt:$t$,
  $t$Kein Druck, keine Massenbewerbung — du hast die Wahl.

Viele Grüße
Dein Werkpair-Team$t$,
  $t$Angebot ansehen
{{link}}$t$,
  'brief',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Müller GmbH"},{"key":"ort","label":"Ort","beispiel":"München"},{"key":"gewerk","label":"Gewerk","beispiel":"Elektriker"},{"key":"link","label":"Link zum Angebot","beispiel":"https://werkpair.de/angebot/…"}]$j$::jsonb,
  true
),
(
  'termin_bestaetigt',
  'Kennenlern-Termin bestätigt',
  'Vermittlung',
  $t$Dein Termin steht$t$,
  $t$Kennenlernen mit {{firma}} am {{termin_datum}}$t$,
  $t$Hallo {{vorname}},

dein Kennenlernen mit {{firma}} ist bestätigt. Hier die wichtigsten Infos:$t$,
  $t$Du musst nichts vorbereiten — komm einfach so, wie du bist. Falls etwas dazwischenkommt, sag uns rechtzeitig Bescheid.

Viel Erfolg!
Dein Werkpair-Team$t$,
  $t$Wann: {{termin_datum}} um {{termin_uhrzeit}}
Wo: {{firma}}, {{ort}}$t$,
  'brief',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Müller GmbH"},{"key":"ort","label":"Ort","beispiel":"München"},{"key":"termin_datum","label":"Datum","beispiel":"Di, 2. September"},{"key":"termin_uhrzeit","label":"Uhrzeit","beispiel":"14:00 Uhr"}]$j$::jsonb,
  true
),
(
  'termin_erinnerung',
  'Termin-Erinnerung (24 h)',
  'Vermittlung',
  $t$Morgen ist es soweit$t$,
  $t$Erinnerung: Morgen dein Termin bei {{firma}}$t$,
  $t$Hallo {{vorname}},

kleine Erinnerung: Morgen um {{termin_uhrzeit}} lernst du {{firma}} kennen. Wir drücken dir die Daumen!$t$,
  $t$Bis morgen!
Dein Werkpair-Team$t$,
  $t$Wann: {{termin_datum}}, {{termin_uhrzeit}}
Wo: {{firma}}, {{ort}}$t$,
  'zentriert',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Müller GmbH"},{"key":"ort","label":"Ort","beispiel":"München"},{"key":"termin_datum","label":"Datum","beispiel":"Di, 2. September"},{"key":"termin_uhrzeit","label":"Uhrzeit","beispiel":"14:00 Uhr"}]$j$::jsonb,
  true
),
(
  'zusage',
  'Zusage / Der Betrieb möchte dich',
  'Vermittlung',
  $t$Glückwunsch, {{vorname}}!$t$,
  $t${{firma}} möchte mit dir weitermachen$t$,
  $t$Hallo {{vorname}},

großartige Neuigkeiten: {{firma}} möchte dich an Bord holen! Der Betrieb hat sich für dich entschieden — das hast du dir verdient.$t$,
  $t$Die Details klären wir direkt mit dir. Wir freuen uns riesig für dich!

Herzlichen Glückwunsch
Dein Werkpair-Team$t$,
  $t$Nächste Schritte ansehen
{{link}}$t$,
  'brief',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Müller GmbH"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/…"}]$j$::jsonb,
  true
),
(
  'absage',
  'Freundliche Absage',
  'Vermittlung',
  $t$Diesmal hat es nicht gepasst$t$,
  $t$Es geht weiter, {{vorname}}$t$,
  $t$Hallo {{vorname}},

bei {{firma}} hat es diesmal leider nicht geklappt. Das sagt nichts über dein Können — manchmal passt es einfach nicht zu 100 %.

Dein Profil bleibt aktiv, und die nächsten Betriebe warten schon.$t$,
  $t$Kopf hoch — wir melden uns, sobald der nächste passende Betrieb da ist.

Viele Grüße
Dein Werkpair-Team$t$,
  $t$Weitere Angebote entdecken
{{link}}$t$,
  'brief',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Müller GmbH"},{"key":"link","label":"Link","beispiel":"https://werkpair.de/…"}]$j$::jsonb,
  true
),
(
  'empfehlungspraemie',
  'Empfehlungsprämie ausgezahlt',
  'Vermittlung',
  $t${{betrag}} für dich$t$,
  $t$Deine Empfehlungsprämie ist da$t$,
  $t$Hallo {{vorname}},

danke, dass du Werkpair weitersagst! Deine Empfehlung war erfolgreich — dafür bekommst du {{betrag}}.$t$,
  $t$Kennst du noch jemanden aus dem Handwerk? Empfiehl weiter und sichere dir die nächste Prämie.

Viele Grüße
Dein Werkpair-Team$t$,
  $t$Weiterempfehlen
{{link}}$t$,
  'zentriert',
  $j$[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"betrag","label":"Betrag","beispiel":"20 €"},{"key":"link","label":"Empfehlungs-Link","beispiel":"https://werkpair.de/empfehlen/…"}]$j$::jsonb,
  true
)
on conflict (event) do nothing;
