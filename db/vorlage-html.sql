-- Eigenes, hochgeladenes HTML-Design pro Vorlage. Ist es gesetzt, wird es beim
-- Rendern 1:1 verwendet (nur {{variablen}} + {{logo}} ersetzt).
alter table admin.benachrichtigung_vorlage
  add column if not exists html text;
