-- Finanz-Erweiterung: Rechnungsarten, Empfänger/Positionen, Steuer, sowie
-- Vorbereitung der späteren Bankanbindung. Baut auf der bestehenden
-- admin.invoice auf (Status OFFEN/BEZAHLT/UEBERFAELLIG/STORNIERT bleibt).

alter table admin.invoice add column if not exists art text not null default 'VERMITTLUNG';
-- Rechnungsart: VERMITTLUNG | PREMIUM | REFERRAL | SONSTIGE
alter table admin.invoice add column if not exists referral_id text;
alter table admin.invoice add column if not exists recipient_name text;
alter table admin.invoice add column if not exists recipient_address text;
alter table admin.invoice add column if not exists positionen jsonb;  -- Rechnungspositionen [{bezeichnung, menge, einzelpreis_cents, betrag_cents}]
alter table admin.invoice add column if not exists tax_rate integer not null default 0;  -- USt in %
alter table admin.invoice add column if not exists service_date date;  -- Leistungsdatum

-- Bankkonten (Vorbereitung — noch keine echte Anbindung).
create table if not exists admin.bank_account (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank_name text,
  iban text,
  bic text,
  provider text not null default 'MANUELL',      -- MANUELL | GOCARDLESS | FINAPI | ...
  status text not null default 'VORBEREITET',     -- VORBEREITET | VERBUNDEN | GETRENNT
  balance_cents bigint,
  connected_at timestamptz,
  created_by uuid references admin.employee(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Kontobewegungen (Import/Sync später; heute manuell/CSV als Vorbereitung).
create table if not exists admin.bank_transaction (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references admin.bank_account(id),
  booked_at date,
  amount_cents bigint not null,
  currency text not null default 'EUR',
  purpose text,
  counterparty_name text,
  counterparty_iban text,
  matched_invoice_id uuid references admin.invoice(id),
  status text not null default 'UNMATCHED',        -- UNMATCHED | MATCHED | IGNORED
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists bank_tx_account_idx on admin.bank_transaction(account_id);
create index if not exists bank_tx_status_idx on admin.bank_transaction(status);
