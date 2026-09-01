-- Anwerbe-Pipeline für Betriebe: zusätzliche Stufen (Systemvorstellung, Vertrag)
-- und die Übergabe an einen echten Betrieb. Additiv, idempotent.
alter table admin.company_lead
  add column if not exists termin_at   timestamptz,          -- geplante Systemvorstellung (Team-Meeting/Demo)
  add column if not exists vertrag_at  timestamptz,          -- Zeitpunkt der Vertragsunterschrift
  add column if not exists company_id  text;                 -- verknüpfter public."Company".id nach Übernahme
