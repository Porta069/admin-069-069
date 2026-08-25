-- Erstlogin-Einrichtung: markiert, ob ein Mitarbeiter den geführten
-- Onboarding-Assistenten (2FA + Handy-Benachrichtigungen) durchlaufen hat.
alter table admin.employee
  add column if not exists onboarded_at timestamptz;
