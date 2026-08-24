-- Remap bestehender Kandidaten-Status auf das neue, einzige Status-System.
--   IN_BEARBEITUNG → ANGERUFEN     GEPRUEFT     → MATCHING
--   VORGESCHLAGEN  → ABWICKLUNG    INTERVIEW    → BEWERBUNG
--   ZUSAGE         → ANGENOMMEN    VERMITTELT   → ANGENOMMEN
-- NEU, MATCHING, BEWERBUNG, ABGELEHNT, INAKTIV bleiben unverändert.

update admin.candidate_meta set status = case status
  when 'IN_BEARBEITUNG' then 'ANGERUFEN'
  when 'GEPRUEFT'       then 'MATCHING'
  when 'VORGESCHLAGEN'  then 'ABWICKLUNG'
  when 'INTERVIEW'      then 'BEWERBUNG'
  when 'ZUSAGE'         then 'ANGENOMMEN'
  when 'VERMITTELT'     then 'ANGENOMMEN'
  else status
end
where status in ('IN_BEARBEITUNG','GEPRUEFT','VORGESCHLAGEN','INTERVIEW','ZUSAGE','VERMITTELT');
