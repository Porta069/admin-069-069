-- Trigram-Indizes für die ILIKE '%…%'-Suche (global + Listen) und ein
-- funktionaler Index für den lower(email)-Join im Matching.

create extension if not exists pg_trgm;

-- Plattform-Suche
create index if not exists user_firstname_trgm on public."User" using gin ("firstName" gin_trgm_ops);
create index if not exists user_lastname_trgm  on public."User" using gin ("lastName" gin_trgm_ops);
create index if not exists user_email_trgm      on public."User" using gin (email gin_trgm_ops);
create index if not exists company_name_trgm    on public."Company" using gin (name gin_trgm_ops);
create index if not exists company_ort_trgm     on public."Company" using gin (ort gin_trgm_ops);
create index if not exists company_kontakt_trgm on public."Company" using gin ("kontaktName" gin_trgm_ops);
create index if not exists jobposting_title_trgm on public."JobPosting" using gin (title gin_trgm_ops);

-- Dashboard-Notizen
create index if not exists note_content_trgm on admin.note using gin (content gin_trgm_ops);

-- Matching-Join per lower(email)
create index if not exists user_lower_email_idx on public."User" (lower(email));
