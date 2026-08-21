-- Mitarbeiter-Profil: Profilbild-URL + öffentlicher Avatar-Bucket.
-- avatar_url zeigt auf ein Objekt im öffentlichen Supabase-Storage-Bucket
-- "avatars" (öffentlich lesbar, Upload nur serverseitig via Service-Key).

alter table admin.employee add column if not exists avatar_url text;

-- Öffentlicher Avatar-Bucket (idempotent). Öffentlich lesbar über
--   {SUPABASE_URL}/storage/v1/object/public/avatars/<key>
-- Schreiben passiert ausschließlich serverseitig mit dem Service-Key
-- (RLS wird dabei umgangen), daher keine zusätzlichen Storage-Policies nötig.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
