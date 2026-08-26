-- E-Mail-Feinschliff: Footer-Text auf die Content-Kante ausrichten.
-- In allen eigenen HTML-Designs war der Petrol-Footer mit 32px Innenabstand
-- gesetzt, der Content darüber (Headline, Text, Detailbox, Button) aber mit 44px.
-- Dadurch stand der Footer-Text 12px weiter links als der restliche Inhalt.
-- Angleichung auf 44px → alle Textkanten fluchten (Panels bleiben bei 24px).
-- Idempotent; Designsprache unverändert (nur Abstand).
update admin.benachrichtigung_vorlage
  set html = replace(html, 'padding:26px 32px', 'padding:26px 44px')
  where html like '%padding:26px 32px%';
