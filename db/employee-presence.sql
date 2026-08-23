-- Präsenz-Status je Mitarbeiter (getrennt vom Konto-Status `status`).
-- `presence` = explizit/manuell gesetzter Zustand:
--   'AVAILABLE' (Standard) | 'ABWESEND' | 'URLAUB' | 'IM_CALL'
-- Die effektive Online-Anzeige leitet sich zusätzlich aus last_seen_at ab:
--   AVAILABLE + last_seen frisch -> Online, sonst Offline. ABWESEND/URLAUB/IM_CALL
--   haben Vorrang. So braucht Online kein Aufräumen (läuft von selbst ab).

alter table admin.employee
  add column if not exists presence text not null default 'AVAILABLE',
  add column if not exists last_seen_at timestamptz;
