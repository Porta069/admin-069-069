-- Performance: Indizes für entity-gescopte Lookups (Kandidaten-/Detailseiten
-- filtern admin.task und admin.appointment nach (entity_type, entity_id)).
create index if not exists task_entity_idx
  on admin.task (entity_type, entity_id) where deleted_at is null;
create index if not exists appointment_entity_idx
  on admin.appointment (entity_type, entity_id) where deleted_at is null;
