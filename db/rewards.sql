-- Kandidaten-Belohnungen:
--  • €20 Affiliate-Bonus (über Aufgabe mit Tag „finanzen", bei Vermittlung)
--  • €200 Treueprämie nach 8 Wochen (retention_due_at) an vermittelte Kandidaten.

alter table admin.placement
  add column if not exists retention_due_at  timestamptz,
  add column if not exists retention_paid_at timestamptz;

-- Fällig 8 Wochen (56 Tage) nach der Vermittlung. Bestehende Placements nachziehen.
update admin.placement
   set retention_due_at = placed_at + interval '56 days'
 where retention_due_at is null and placed_at is not null;

-- „finanzen"-Tag sicherstellen (Markenfarbe grün).
insert into admin.tag (name, color)
select 'finanzen', '#115F5B'
where not exists (select 1 from admin.tag where lower(name) = 'finanzen');
