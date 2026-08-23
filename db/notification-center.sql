-- Mitteilungszentrale: Kategorien, Wahrnehmen-Status (mit 30-s-Undo → Hartlöschen),
-- Absender (für persönliche Mitteilungen) und Entity-Tags (Nutzer/Unternehmen taggen).

alter table admin.notification
  add column if not exists kategorie text not null default 'EREIGNIS',
  add column if not exists acknowledged_at timestamptz,
  add column if not exists sender_employee_id uuid references admin.employee(id);

-- Sweeper: Index fürs Hartlöschen wahrgenommener Mitteilungen nach dem Undo-Fenster.
create index if not exists notification_ack_idx
  on admin.notification (acknowledged_at)
  where acknowledged_at is not null;

-- Zentrale zeigt offene (noch nicht wahrgenommene) Mitteilungen je Empfänger/Kategorie.
create index if not exists notification_offen_idx
  on admin.notification (employee_id, kategorie, created_at)
  where acknowledged_at is null;

-- Entity-Tags für persönliche Mitteilungen: getaggte Nutzer/Unternehmen.
create table if not exists admin.notification_tag (
  notification_id uuid not null references admin.notification(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  primary key (notification_id, entity_type, entity_id)
);
