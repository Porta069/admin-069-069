-- Auszahlungs-Belege idempotent an die Auszahlung binden: pro payout höchstens
-- EIN Beleg → kein Doppel-Beleg mehr bei Retry/Nebenläufigkeit.

alter table admin.invoice add column if not exists payout_id uuid;

create unique index if not exists invoice_payout_uidx
  on admin.invoice (payout_id)
  where payout_id is not null and deleted_at is null;
