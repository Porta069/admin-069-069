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
-- STAND: Das Fachprofil liegt seit dem Funnel-Umbau in eigenen typisierten
-- Tabellen (public."CraftProfile", public."WorkLocation") statt im JSON-Feld
-- `User.profileData`. Diese View liest daraus:
--   profession   = COALESCE(berufsbezeichnung, gewerk)   — treu zum früheren
--                  COALESCE(profil.beruf, profil.bereich).
--   federalState = Bundesland aus dem Label des ersten Arbeitsorts (Heuristik
--                  wie zuvor: 2. Komma-Teil; Label ist Freitext → sonst NULL).
-- `profileData` wird hier NICHT mehr referenziert; die Spalte kann fallen,
-- sobald auch der Dashboard-Code sie nicht mehr liest (src/lib/matching/*).
--
-- CREATE OR REPLACE erhält den exakten 18-Spalten-Kontrakt (kein DROP/CASCADE).
-- Nur SELECT auf public.* — keine Mutation an Plattform-Tabellen.

create or replace view admin.candidate as
 select u.id,
    u."firstName",
    u."lastName",
    u.email,
    u.phone,
    coalesce(nullif(btrim(cp.berufsbezeichnung), ''), cp.gewerk) as profession,
    nullif(split_part(wl.label, ', '::text, 2), ''::text) as "federalState",
    null::integer as "birthYear",
    null::text as availability,
    null::text as "searchIntent",
    'SUBMITTED'::text as status,
    coalesce(u."emailVerified", false) as verified,
    null::timestamp with time zone as "verifiedAt",
    null::timestamp with time zone as "consentAt",
    u."createdAt",
    u."updatedAt",
    null::timestamp with time zone as "retentionUntil",
    'user'::text as source
   from public."User" u
     left join public."CraftProfile" cp on cp."userId" = u.id
     left join lateral (
        select w.label
          from public."WorkLocation" w
         where w."userId" = u.id
         order by w."createdAt"
         limit 1
     ) wl on true
  where u.role = 'APPLICANT'::public."UserRole"
    and not (exists ( select 1
           from public."Application" a
          where a.status <> 'ERASED'::public."ApplicationStatus"
            and lower(a.email) = lower(u.email)))
union all
 select a.id,
    a."firstName",
    a."lastName",
    a.email,
    a.phone,
    a.profession,
    a."federalState",
    a."birthYear",
    a.availability,
    a."searchIntent"::text as "searchIntent",
    a.status::text as status,
    a.verified,
    a."verifiedAt",
    a."consentAt",
    a."createdAt",
    a."updatedAt",
    a."retentionUntil",
    'application'::text as source
   from public."Application" a
  where a.status <> 'ERASED'::public."ApplicationStatus";
