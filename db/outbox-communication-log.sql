-- Zentrales Kommunikations-Logging: JEDE versendete E-Mail an Kandidat/Unternehmen
-- wird beim Versand (processOutbox) automatisch im Verlauf protokolliert —
-- Standard-Vorlage als Nummer (event_code), individuelle Mail nur als Betreff.
-- event_code/created_by werden dafür an der Outbox mitgeführt.
alter table admin.outbox_email add column if not exists event_code int;
alter table admin.outbox_email add column if not exists created_by uuid;
