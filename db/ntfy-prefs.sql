-- Handy-Push-Präferenzen je Mitarbeiter: {gruppenKey: boolean}.
-- NULL / fehlender Key = an (Standard: alle Gruppen aktiv).
alter table admin.employee
  add column if not exists ntfy_prefs jsonb;
