-- TOTP-Replay-Schutz: zuletzt akzeptierten Code + Zeitpunkt je Mitarbeiter
-- speichern, um Wiederverwendung innerhalb des Gültigkeitsfensters abzulehnen.
alter table admin.employee add column if not exists totp_last_code text;
alter table admin.employee add column if not exists totp_last_at timestamptz;
