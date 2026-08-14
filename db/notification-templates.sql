-- Zentrale Benachrichtigungs-Vorlagen: pro Ereignis (Account erstellt/gelöscht,
-- Datenexport, AGB-/Datenschutz-Update, E-Mail-/Telefon-Änderung …) eine
-- editierbare Vorlage mit Platzhaltern ({{name}}, {{email}} …). Wird zentral
-- bearbeitet und später autonom nach dem jeweiligen Ereignis versendet.

create table if not exists admin.benachrichtigung_vorlage (
  id uuid primary key default gen_random_uuid(),
  event text unique not null,
  name text not null,
  kategorie text not null default 'Konto',
  titel text not null,
  betreff text,
  einleitung text,
  schluss text,
  variablen jsonb not null default '[]',   -- [{ key, label, beispiel }]
  enabled boolean not null default true,
  updated_by uuid references admin.employee(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
