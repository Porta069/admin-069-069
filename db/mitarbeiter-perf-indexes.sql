-- Indizes für die Mitarbeiter-Übersicht/-Profile (Zuordnungs- & Telefonzähler).
-- Rein additiv; beschleunigt die count-Subqueries je Mitarbeiter.
create index if not exists candidate_meta_assignee_idx
  on admin.candidate_meta (assignee_id) where assignee_id is not null;
create index if not exists company_meta_assignee_idx
  on admin.company_meta (assignee_id) where assignee_id is not null;
create index if not exists call_session_employee_idx
  on admin.call_session (employee_id) where deleted_at is null;
create index if not exists communication_employee_idx
  on admin.communication (employee_id) where deleted_at is null;
create index if not exists company_lead_assignee_idx
  on admin.company_lead (assignee_id) where deleted_at is null and assignee_id is not null;
