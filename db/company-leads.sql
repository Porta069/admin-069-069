-- Unternehmens-Anwerbung: noch nicht registrierte Betriebe, die angeworben
-- werden sollen (B2B-Vertriebs-Pipeline, getrennt von public."Company").
create table if not exists admin.company_lead (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  ansprechpartner text,
  email         text,
  phone         text,
  ort           text,
  website       text,
  quelle        text,
  status        text not null default 'NEU',   -- NEU, KONTAKTIERT, INTERESSIERT, GEWONNEN, ABGELEHNT
  notiz         text,
  assignee_id   uuid references admin.employee(id),
  last_contacted_at timestamptz,
  created_by    uuid references admin.employee(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists company_lead_status_idx on admin.company_lead(status) where deleted_at is null;
