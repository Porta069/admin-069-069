-- Einheitliches Auszahlungs-Register für alle Prämientypen. Rein additiv.
-- Führt Referral-Prämien, Affiliate-Boni und Treueprämien als nachverfolgbare
-- Auszahlungen mit Lebenszyklus, Bankdaten, Beleg (admin.invoice) und E-Mail.
create table if not exists admin.payout (
  id uuid primary key default gen_random_uuid(),
  art text not null default 'SONSTIGE',            -- REFERRAL | AFFILIATE | RETENTION | SONSTIGE
  status text not null default 'OFFEN',            -- OFFEN | GENEHMIGT | AUSGEZAHLT | STORNIERT
  recipient_name text not null,
  recipient_kind text,                             -- partner | werber | candidate | sonstige
  recipient_email text,
  amount_cents integer not null,
  bank_holder text,
  bank_iban text,
  bank_bic text,
  method text not null default 'UEBERWEISUNG',     -- UEBERWEISUNG | PAYPAL | SONSTIGE
  entity_type text,                                -- candidate | referral | placement | partner
  entity_id text,
  referral_id text,                                -- public."Referral".id (Backend-Prämienlogik)
  placement_id uuid,                               -- admin.placement.id (Treueprämie)
  invoice_id uuid references admin.invoice(id),    -- erzeugter Beleg/Gutschrift
  email_sent_at timestamptz,
  notiz text,
  due_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  paid_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Eine Auszahlung je Quelle (Typ + Kontext) — verhindert Doppelanlage.
create unique index if not exists payout_source_uidx
  on admin.payout (art, entity_type, entity_id) where deleted_at is null;
create index if not exists payout_status_idx on admin.payout (status) where deleted_at is null;
create index if not exists payout_art_idx on admin.payout (art) where deleted_at is null;

-- Auszahlungs-Automatisierung standardmäßig AUS (vorbereitet).
insert into admin.setting (key, value)
values ('payouts', '{"auto": false}'::jsonb)
on conflict (key) do nothing;
