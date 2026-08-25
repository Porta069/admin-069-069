-- Fixkosten-Bereich der Finanzen: laufende Kosten (monatlich/jährlich) und
-- Einmalzahlungen, jeweils mit optionalem Beleg (documents-Bucket, privat).
-- Die Umrechnung auf pro Monat / pro Jahr passiert in der Anwendung.

create table if not exists admin.fixed_cost (
  id            uuid primary key default gen_random_uuid(),
  bezeichnung   text not null,
  kind          text not null default 'LAUFEND',   -- LAUFEND | EINMALIG
  intervall     text,                              -- MONTHLY | YEARLY (nur LAUFEND)
  amount_cents  bigint not null,
  kategorie     text,
  faellig_on    date,                              -- Datum (Einmalzahlung) bzw. Beginn
  invoice_path  text,                              -- Objekt-Key im documents-Bucket
  invoice_name  text,                              -- Original-Dateiname
  notiz         text,
  created_by    uuid references admin.employee(id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint fixed_cost_kind_chk check (kind in ('LAUFEND','EINMALIG')),
  constraint fixed_cost_intervall_chk
    check (intervall is null or intervall in ('MONTHLY','YEARLY')),
  constraint fixed_cost_amount_chk check (amount_cents >= 0)
);

create index if not exists fixed_cost_aktiv_idx
  on admin.fixed_cost (created_at desc) where deleted_at is null;
