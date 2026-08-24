-- Interner Mitarbeiter-Chat: echte 1:1-Konversationen (hin & her), erreichbar
-- über den Chat-Button oben rechts neben der Benachrichtigungsglocke.
-- Getaggte Nutzer/Unternehmen landen zusätzlich in deren Kommunikations-Historie
-- (admin.communication, Kanal MITTEILUNG, Richtung INTERN) — analog zu den
-- persönlichen Mitteilungen.

create table if not exists admin.chat_message (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references admin.employee(id) on delete cascade,
  recipient_id uuid not null references admin.employee(id) on delete cascade,
  body         text not null,
  -- Getaggte Entitäten als [{entityType, entityId, label}] — für Chips & Links.
  tags         jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  deleted_at   timestamptz,
  constraint chat_message_not_self check (sender_id <> recipient_id)
);

-- Thread-Abfrage (beide Richtungen zwischen zwei Personen), chronologisch.
create index if not exists chat_message_thread_idx
  on admin.chat_message (sender_id, recipient_id, created_at)
  where deleted_at is null;
create index if not exists chat_message_thread_rev_idx
  on admin.chat_message (recipient_id, sender_id, created_at)
  where deleted_at is null;

-- Ungelesene Nachrichten je Empfänger (Badge am Chat-Button).
create index if not exists chat_message_unread_idx
  on admin.chat_message (recipient_id, sender_id)
  where read_at is null and deleted_at is null;
