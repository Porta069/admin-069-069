-- E-Mail-Outbox robust gegen Nebenläufigkeit und transiente Fehler:
-- atomares Claiming (status SENDING) + Retry mit Backoff.

alter table admin.outbox_email add column if not exists attempts int not null default 0;
alter table admin.outbox_email add column if not exists next_retry_at timestamptz;
alter table admin.outbox_email add column if not exists claimed_at timestamptz;

create index if not exists outbox_pickup_idx
  on admin.outbox_email (status, next_retry_at)
  where status in ('PENDING', 'SENDING');
