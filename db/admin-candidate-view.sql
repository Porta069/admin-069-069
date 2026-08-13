-- admin.candidate — einheitliche Kandidatenquelle fürs Dashboard.
--
-- Registrierungen auf der Plattform legen `public."User"` (role APPLICANT) an,
-- NICHT `public."Application"`. Das Dashboard baute ursprünglich auf Application
-- auf, wodurch registrierte Jobsuchende unsichtbar blieben. Diese View vereint
-- beide Quellen in der Application-Form, sodass Liste, Detail, Anruf-Interface,
-- Matching-Radar und die Auto-Anruf-Aufgabe registrierte User als Kandidaten
-- sehen. `id` ist die User- bzw. Application-ID (admin.* referenziert lose per
-- text-ID, keine Foreign Keys). Application hat Vorrang (Dedup per E-Mail),
-- falls das Backend künftig Application-Datensätze erzeugt.
--
-- Nur SELECT auf public.* — keine Mutation an Plattform-Tabellen.

create or replace view admin.candidate as
select
  u.id::text as id,
  u."firstName", u."lastName", u.email, u.phone,
  coalesce(
    j.pd->'profil'->>'beruf',
    j.pd->'2'->'profil'->>'beruf',
    j.pd->'profil'->>'bereich',
    j.pd->'2'->'profil'->>'bereich'
  ) as profession,
  null::text        as "federalState",
  null::integer     as "birthYear",
  null::text        as availability,
  null::text        as "searchIntent",
  'SUBMITTED'::text as status,
  coalesce(u."emailVerified", false) as verified,
  null::timestamptz as "verifiedAt",
  null::timestamptz as "consentAt",
  u."createdAt",
  u."updatedAt",
  null::timestamptz as "retentionUntil",
  'user'::text      as source
from public."User" u
cross join lateral (
  select case when u."profileData" is null then '{}'::jsonb
              else u."profileData"::jsonb end as pd
) j
where u.role = 'APPLICANT'
  and not exists (
    select 1 from public."Application" a
    where a.status <> 'ERASED' and lower(a.email) = lower(u.email))
union all
select
  a.id::text, a."firstName", a."lastName", a.email, a.phone, a.profession,
  a."federalState", a."birthYear", a.availability,
  a."searchIntent"::text, a.status::text, a.verified,
  a."verifiedAt", a."consentAt", a."createdAt", a."updatedAt", a."retentionUntil",
  'application'::text
from public."Application" a
where a.status <> 'ERASED';
