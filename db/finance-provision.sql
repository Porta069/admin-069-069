-- Provision „% vom Jahresgehalt" — additiv. Speichert auf der Rechnung, aus
-- welchem Jahresgehalt und mit welchem Prozentsatz die Erfolgsprovision
-- berechnet wurde (Nachvollziehbarkeit). Bestehende Rechnungen bleiben NULL.
alter table admin.invoice add column if not exists annual_salary_cents bigint;
alter table admin.invoice add column if not exists provision_percent numeric(5,2);
