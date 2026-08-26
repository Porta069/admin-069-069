-- Kandidaten-Aktivierung: Neuregistrierungen sind „Zu aktivieren" (aktiviert_at
-- null) und stehen NICHT im Matching/Vermittlung. Erst ein durchgeführtes
-- Telefonat (kein Sackgasse, kein geplanter Rückruf) aktiviert sie.
alter table admin.candidate_meta
  add column if not exists aktiviert_at timestamptz;

-- Backfill, damit bereits bearbeitete Kandidaten sichtbar bleiben:
-- 1) Alle mit Status jenseits von NEU gelten als aktiviert.
update admin.candidate_meta
  set aktiviert_at = coalesce(updated_at, now())
  where aktiviert_at is null and status is not null and status <> 'NEU';

-- 2) Alle mit abgeschlossenem, qualifizierendem Anruf (kein Sackgasse/Rückruf).
update admin.candidate_meta cm
  set aktiviert_at = now()
  where cm.aktiviert_at is null and exists (
    select 1 from admin.call_session cs
    where cs.application_id = cm.application_id and cs.status = 'ABGESCHLOSSEN'
      and coalesce(cs.ergebnis,'') not in ('SACKGASSE','RUECKRUF'));

-- 3) Qualifizierend angerufene ohne Meta-Zeile → Zeile anlegen + aktivieren.
insert into admin.candidate_meta (application_id, status, aktiviert_at, updated_at)
  select distinct cs.application_id, 'ANGERUFEN', now(), now()
  from admin.call_session cs
  where cs.status = 'ABGESCHLOSSEN'
    and coalesce(cs.ergebnis,'') not in ('SACKGASSE','RUECKRUF')
    and not exists (select 1 from admin.candidate_meta cm where cm.application_id = cs.application_id)
  on conflict (application_id) do nothing;
