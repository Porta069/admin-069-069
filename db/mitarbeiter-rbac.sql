-- Mitarbeiter- & RBAC-Erweiterung — rein ADDITIV. Verändert kein bestehendes
-- Verhalten: neue Spalten sind nullable bzw. haben Defaults, bestehende Konten
-- behalten permission_overrides = NULL (⇒ Rechte kommen weiter aus der Rolle).

-- ── employee: Zusatzfelder ──────────────────────────────────────────────────
alter table admin.employee add column if not exists username text;
alter table admin.employee add column if not exists phone text;
alter table admin.employee add column if not exists first_name text;
alter table admin.employee add column if not exists last_name text;
alter table admin.employee add column if not exists created_by uuid;
-- NULL = folgt dem Template/der Rolle; gesetzt = individuell angepasste Rechte.
alter table admin.employee add column if not exists permission_overrides jsonb;

-- Username für bestehende Konten aus dem E-Mail-Lokalteil ableiten (nur wenn leer).
update admin.employee
   set username = lower(split_part(email, '@', 1))
 where username is null;

-- Vor-/Nachname aus dem vorhandenen Namen ableiten (nur wenn leer).
update admin.employee
   set first_name = coalesce(first_name, split_part(name, ' ', 1)),
       last_name  = coalesce(last_name, nullif(trim(substr(name, length(split_part(name,' ',1)) + 1)), ''))
 where first_name is null or last_name is null;

-- Eindeutigkeit case-insensitive, aber gelöschte Konten ausgenommen.
create unique index if not exists employee_username_uidx
  on admin.employee (lower(username)) where deleted_at is null and username is not null;

-- ── role: Template-Metadaten + Hierarchie-Level ─────────────────────────────
alter table admin.role add column if not exists icon text;
alter table admin.role add column if not exists level int not null default 20;
alter table admin.role add column if not exists created_by uuid;
alter table admin.role add column if not exists updated_at timestamptz not null default now();

-- Hierarchie-Level der System-Rollen (Master=100, Manager=80, Teamlead=60, Staff=20).
update admin.role set level = 100 where id = 'SUPERADMIN';
update admin.role set level = 80  where id = 'ADMIN';
update admin.role set level = 60  where id = 'TEAMLEAD';
update admin.role set level = 20  where id = 'STAFF';
