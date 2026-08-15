-- Zusätzliche Benachrichtigungs-Vorlage: Kontosperrung wegen Verstoß gegen die
-- Nutzungsbedingungen (manuell aus dem Kandidaten-Kommunikationstab versendbar).
insert into admin.benachrichtigung_vorlage
  (event, name, kategorie, titel, betreff, einleitung, schluss, variablen,
   enabled, variante, hervorhebung)
select
  'verstoss_deaktivierung',
  'Sperrung wegen Verstoß gegen die Nutzungsbedingungen',
  'Konto',
  'Sperrung deines Kontos',
  'Dein Konto wurde wegen eines Verstoßes gesperrt',
  'Hallo {{name}},

wir mussten dein Konto ({{email}}) am {{datum}} sperren, weil wir einen Verstoß gegen unsere Nutzungsbedingungen festgestellt haben: {{grund}}. Der Zugang zur Plattform ist ab sofort deaktiviert.',
  'Wenn du der Ansicht bist, dass es sich um einen Irrtum handelt, melde dich bitte innerhalb von 14 Tagen unter support@portawerk.de — dann prüfen wir den Fall erneut.

Dein PORTAWERK-Team',
  '[{"key":"name","label":"Name","beispiel":"Max Mustermann"},{"key":"email","label":"E-Mail","beispiel":"max.mustermann@example.de"},{"key":"datum","label":"Datum","beispiel":"15.08.2026"},{"key":"grund","label":"Grund des Verstoßes","beispiel":"wiederholte Falschangaben im Profil"}]'::jsonb,
  true, 'brief', null
where not exists (
  select 1 from admin.benachrichtigung_vorlage where event = 'verstoss_deaktivierung');
