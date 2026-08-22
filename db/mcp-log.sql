-- Protokoll aller MCP-Server-Aktionen (Lese- und v. a. Schreibzugriffe).
-- Steuerung + Anzeige unter /einstellungen/ki. Der Pause-Schalter liegt in
-- admin.setting (key='mcp', value = {"aktiv":bool,"schreiben":bool}).

create table if not exists admin.mcp_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  tool        text        not null,          -- Name des aufgerufenen Tools
  art         text        not null,          -- READ | WRITE
  argumente   jsonb,                          -- Eingabe-Parameter des Aufrufs
  ok          boolean     not null default true,
  info        text                            -- Kurz-Ergebnis / Fehler / betroffene Zeilen
);

create index if not exists mcp_log_created_idx on admin.mcp_log (created_at desc);
create index if not exists mcp_log_art_idx on admin.mcp_log (art, created_at desc);
