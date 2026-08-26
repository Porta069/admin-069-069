-- Werkpair: neue E-Mail-Vorlagen — NUR ergänzend, idempotent.
-- Bestehende Vorlagen (Konto, Sicherheit, Rechtliches, Vermittlung) bleiben unangetastet:
-- kein DELETE, kein UPDATE; INSERT … ON CONFLICT (event) DO NOTHING.

INSERT INTO admin.benachrichtigung_vorlage
  (event, name, kategorie, titel, betreff, einleitung, schluss, hervorhebung, variante, variablen, enabled)
VALUES
-- 1 · Profil vervollständigen (Nudge)
('lifecycle.profil_nudge', 'Profil vervollständigen', 'Lifecycle',
 'Zeig den Betrieben, was du kannst',
 'Ein Schritt fehlt noch zu deinen ersten Angeboten',
 'Hallo {{vorname}}, Betriebe achten vor allem auf dein Gewerk, deine Erfahrung und deinen Ort. Ergänze kurz die letzten Angaben — dann schalten wir dein Profil für passende Betriebe frei. 2 Minuten, die sich lohnen.',
 'Danach heißt es: zurücklehnen — die Betriebe kommen zu dir. Dein Werkpair-Team',
 E'Jetzt vervollständigen\n{{link}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"link","label":"Profil-Link","beispiel":"https://werkpair.de/profil"}]'::jsonb,
 true),

-- 2 · Neues Interesse / Match (Handwerker)
('match.betrieb_interesse', 'Neues Interesse von Betrieb', 'Lifecycle',
 'Gute Nachrichten, {{vorname}}!',
 '{{firma}} möchte dich kennenlernen',
 'Hallo {{vorname}}, {{firma}} aus {{ort}} sucht {{gewerk}} und ist auf dein Profil aufmerksam geworden. Der Betrieb bewirbt sich bei dir — schau dir das Angebot an und sag uns, ob wir ein Kennenlernen einfädeln sollen.',
 'Du entscheidest, wir kümmern uns um den Rest. Dein Werkpair-Team',
 E'Angebot ansehen\n{{link}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Huber GmbH"},{"key":"ort","label":"Ort","beispiel":"Heilbronn"},{"key":"gewerk","label":"Gewerk","beispiel":"Elektroniker"},{"key":"link","label":"Angebots-Link","beispiel":"https://werkpair.de/angebot/123"}]'::jsonb,
 true),

-- 3 · Termin-Erinnerung (24 h vorher)
('termin.erinnerung_24h', 'Termin-Erinnerung (24 h)', 'Termine',
 'Kurz zur Erinnerung',
 'Erinnerung: Morgen dein Termin bei {{firma}}',
 'Hallo {{vorname}}, morgen um {{termin_uhrzeit}} lernst du {{firma}} kennen. Du musst nichts vorbereiten — komm einfach so, wie du bist.',
 'Wir drücken dir die Daumen — das wird gut. Dein Werkpair-Team',
 E'{{termin_datum}} · {{termin_uhrzeit}}\nbei {{firma}}',
 'zentriert',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Huber GmbH"},{"key":"termin_datum","label":"Datum","beispiel":"12.09.2026"},{"key":"termin_uhrzeit","label":"Uhrzeit","beispiel":"14:00 Uhr"}]'::jsonb,
 true),

-- 4 · Absage (freundlich)
('match.absage', 'Absage (freundlich)', 'Lifecycle',
 'Kopf hoch, {{vorname}}',
 E'Diesmal hat''s nicht gepasst — aber es geht weiter',
 'Hallo {{vorname}}, bei {{firma}} hat es diesmal nicht geklappt. Das sagt nichts über dein Können. Dein Profil bleibt aktiv, und wir melden uns, sobald der nächste passende Betrieb bei dir anklopft.',
 'Die nächsten Betriebe warten schon. Dein Werkpair-Team',
 E'Weitere Angebote entdecken\n{{link}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"firma","label":"Betrieb","beispiel":"Elektro Huber GmbH"},{"key":"link","label":"Angebote-Link","beispiel":"https://werkpair.de/angebote"}]'::jsonb,
 true),

-- 5 · Reaktivierung nach Inaktivität
('lifecycle.reaktivierung', 'Reaktivierung', 'Lifecycle',
 'Da tut sich was für dich',
 'Neue Betriebe suchen {{gewerk}} in {{ort}}',
 'Hallo {{vorname}}, in den letzten Wochen sind neue Betriebe dazugekommen, die genau nach deinem Profil suchen. Ein kurzer Blick lohnt sich — vielleicht ist dein nächster Job schon dabei.',
 'Wir haben dich nicht vergessen. Dein Werkpair-Team',
 E'Angebote ansehen\n{{link}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"gewerk","label":"Gewerk","beispiel":"Elektroniker"},{"key":"ort","label":"Ort","beispiel":"Heilbronn"},{"key":"link","label":"Angebote-Link","beispiel":"https://werkpair.de/angebote"}]'::jsonb,
 true),

-- 6 · Empfehlungsprämie
('lifecycle.empfehlung_praemie', 'Empfehlungsprämie', 'Lifecycle',
 '{{betrag}} für dich, {{vorname}}',
 'Deine Empfehlungsprämie ist unterwegs',
 'Hallo {{vorname}}, deine Empfehlung war erfolgreich — dafür gibt''s {{betrag}} für dich. Danke, dass du das Handwerk weiterbringst. Kennst du noch jemanden? Empfiehl weiter und sichere dir die nächste Prämie.',
 'Danke, dass du Werkpair weitersagst. Dein Werkpair-Team',
 E'Weiterempfehlen\n{{link}}',
 'zentriert',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"betrag","label":"Prämie","beispiel":"250 €"},{"key":"link","label":"Empfehlungs-Link","beispiel":"https://werkpair.de/empfehlen"}]'::jsonb,
 true),

-- 7 · Neue passende Handwerker (an Betrieb)
('betrieb.neue_kandidaten', 'Neue passende Handwerker', 'Lifecycle',
 'Diese Profile passen zu dir',
 '{{anzahl}} passende Handwerker für {{stelle}}',
 'Hallo {{vorname}}, für deine Stelle {{stelle}} in {{ort}} haben wir {{anzahl}} passende Handwerker gefunden. Sieh dir die Profile an und sag uns, wen du kennenlernen möchtest — um den Termin kümmern wir uns.',
 'Frisch für dich vorausgewählt. Dein Werkpair-Team',
 E'Kandidaten ansehen\n{{link}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Sabine"},{"key":"anzahl","label":"Anzahl","beispiel":"3"},{"key":"stelle","label":"Stelle","beispiel":"Elektroniker (m/w/d)"},{"key":"ort","label":"Ort","beispiel":"Heilbronn"},{"key":"link","label":"Kandidaten-Link","beispiel":"https://werkpair.de/kandidaten"}]'::jsonb,
 true),

-- 8 · Zahlungserinnerung (freundlich)
('abrechnung.zahlungserinnerung', 'Zahlungserinnerung', 'Abrechnung',
 'Nur eine freundliche Erinnerung',
 'Kleine Erinnerung: Rechnung {{rechnungsnummer}}',
 'Hallo {{vorname}}, die Rechnung {{rechnungsnummer}} über {{betrag}} ist noch offen (fällig war der {{faellig_am}}). Falls schon überwiesen — danke, dann ignoriere diese Mail einfach.',
 'Bei Fragen sind wir jederzeit für dich da. Dein Werkpair-Team',
 E'Rechnung {{rechnungsnummer}}\n{{betrag}} · fällig am {{faellig_am}}',
 'brief',
 '[{"key":"vorname","label":"Vorname","beispiel":"Sabine"},{"key":"rechnungsnummer","label":"Rechnungsnummer","beispiel":"WP-2026-0142"},{"key":"betrag","label":"Betrag","beispiel":"1.190,00 €"},{"key":"faellig_am","label":"Fällig am","beispiel":"15.09.2026"}]'::jsonb,
 true),

-- 9 · Produkt-Update
('marketing.produkt_update', 'Produkt-Update', 'Marketing',
 '{{feature_titel}}',
 'Neu bei Werkpair: {{feature_titel}}',
 'Hallo {{vorname}}, wir haben etwas gebaut, das dir Zeit spart: {{feature_titel}}. Probier''s aus und sag uns, wie du''s findest.',
 'Kurz erklärt, warum''s dir hilft. Dein Werkpair-Team',
 E'Ansehen\n{{link}}',
 'zentriert',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"feature_titel","label":"Feature","beispiel":"Terminvorschläge per Klick"},{"key":"link","label":"Feature-Link","beispiel":"https://werkpair.de/neu"}]'::jsonb,
 true),

-- 10 · Feedback erbitten
('marketing.feedback', 'Feedback erbitten', 'Marketing',
 E'Wie läuft''s bei dir?',
 '30 Sekunden für ehrliches Feedback?',
 'Hallo {{vorname}}, wir wollen Werkpair Tag für Tag besser machen — dafür brauchen wir dich. Erzähl uns kurz, was gut läuft und was nicht.',
 'Deine Meinung macht Werkpair besser. Dein Werkpair-Team',
 E'Feedback geben\n{{link}}',
 'zentriert',
 '[{"key":"vorname","label":"Vorname","beispiel":"Max"},{"key":"link","label":"Feedback-Link","beispiel":"https://werkpair.de/feedback"}]'::jsonb,
 true)

ON CONFLICT (event) DO NOTHING;
