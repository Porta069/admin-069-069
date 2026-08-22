-- Index für die Vermittlungen/Umsatz-pro-Mitarbeiter-Subqueries (Cockpit).
create index if not exists placement_employee_idx
  on admin.placement (employee_id)
  where deleted_at is null;
