-- Werbung/Ads-Abteilung. Plattform-agnostisch (meta_instagram, meta_facebook,
-- snapchat, …). API-Zugang ausschließlich über Env-Vars im Backend; hier nur
-- lokale Verwaltung + synchronisierte Kennzahlen (keine Secrets in der DB).
create table if not exists admin.ads_creative (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  typ          text not null default 'IMAGE',   -- IMAGE | VIDEO
  tags         text[] not null default '{}',
  storage_path text,          -- Pfad im Supabase Storage (Upload folgt)
  url          text,          -- optionale externe URL
  thumbnail_url text,
  aspect_ratio text,          -- z. B. 9:16, 1:1, 4:5
  notiz        text,
  created_by   uuid references admin.employee(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists admin.ads_campaign (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  platforms     text[] not null default '{}',   -- meta_instagram | meta_facebook | snapchat
  ziel          text not null default 'REGISTRATIONS',
  status        text not null default 'DRAFT',   -- DRAFT|ACTIVE|PAUSED|ENDED|ERROR
  daily_budget_cents  integer,
  total_budget_cents  integer,
  start_date    date,
  end_date      date,
  targeting     jsonb not null default '{}',     -- geo, alter, geschlecht, interessen, berufe, audiences
  creative_id   uuid references admin.ads_creative(id),
  primaertext   text,
  ueberschrift  text,
  beschreibung  text,
  cta           text default 'SIGN_UP',
  landing_url   text,
  tracking      jsonb not null default '{}',     -- events, pixel-ids
  external_ids  jsonb not null default '{}',     -- plattform -> externe Kampagnen-ID (nach Publish)
  fehler        text,                            -- letzte API-Fehlermeldung
  published_at  timestamptz,
  created_by    uuid references admin.employee(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists ads_campaign_status_idx on admin.ads_campaign(status) where deleted_at is null;

-- Synchronisierte Kennzahlen (pro Tag/Plattform/Kampagne). Kommen später aus
-- den Marketing-APIs; bis dahin leer (keine erfundenen Zahlen).
create table if not exists admin.ads_insight (
  id           bigint generated always as identity primary key,
  campaign_id  uuid references admin.ads_campaign(id),
  platform     text not null,
  ad_set_id    text,
  ad_id        text,
  datum        date not null,
  spend_cents  integer not null default 0,
  impressions  integer not null default 0,
  reach        integer not null default 0,
  clicks       integer not null default 0,
  conversions  integer not null default 0,
  registrations integer not null default 0,
  applications integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (campaign_id, platform, ad_set_id, ad_id, datum)
);
create index if not exists ads_insight_datum_idx on admin.ads_insight(datum);
