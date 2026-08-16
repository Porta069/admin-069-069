-- Kommunikation im Kandidatenprofil wird datensparsam NUR als Nummer
-- (event_code) protokolliert. Jede Benachrichtigungs-Vorlage bekommt eine
-- stabile Nummer (code); beim Anzeigen wird die Nummer über einen Join wieder
-- in das Ereignis (name) übersetzt. Datum/Uhrzeit stehen in occurred_at.

alter table admin.benachrichtigung_vorlage add column if not exists code int;
alter table admin.communication          add column if not exists event_code int;

update admin.benachrichtigung_vorlage set code = c.code from (values
  ('bestaetigungscode', 1), ('passwort_reset', 2), ('email_verifizierung', 3),
  ('passwort_geaendert', 4), ('email_geaendert', 5), ('telefon_geaendert', 6),
  ('account_erstellt', 7), ('account_deaktiviert', 8), ('account_geloescht', 9),
  ('inaktivitaet_warnung', 10), ('profil_aktualisiert', 11), ('daten_download', 12),
  ('datenschutz_update', 13), ('agb_update', 14), ('verstoss_deaktivierung', 15)
) as c(event, code)
where admin.benachrichtigung_vorlage.event = c.event;
