-- Interner „Coding"-Bereich: selbst-gepflegte Entwicklungs-Checkliste (was fehlt
-- noch / was ist erledigt). Nur für das Master-Konto sichtbar. slug macht das
-- Seeding idempotent (spätere Toggles/Einträge bleiben erhalten).

create table if not exists admin.coding_task (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique,
  titel        text not null,
  beschreibung text,
  kategorie    text not null default 'Allgemein',
  prioritaet   text not null default 'MEDIUM',   -- HIGH | MEDIUM | LOW
  erledigt     boolean not null default false,
  erledigt_at  timestamptz,
  sortier      int not null default 100,
  created_by   uuid references admin.employee(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint coding_prio_chk check (prioritaet in ('HIGH','MEDIUM','LOW'))
);
create index if not exists coding_task_aktiv_idx
  on admin.coding_task (kategorie, sortier) where deleted_at is null;

-- Seed: aktueller Stand (Erledigtes = true, Offenes = false).
insert into admin.coding_task (slug, titel, beschreibung, kategorie, prioritaet, erledigt, erledigt_at, sortier) values
  -- Erledigt (Sicherheit)
  ('sec-mcp-explain', 'MCP-SQL-Guards planbasiert (EXPLAIN)', 'Regex-Blocklists durch EXPLAIN-basierte Tabellen-Auflösung ersetzt (Auth/RBAC/Session/Audit gesperrt).', 'Sicherheit', 'HIGH', true, now(), 10),
  ('sec-revoke-authz', 'revokeSession → employees:manage', 'Fremd-Sitzungen beenden nicht mehr nur mit Lese-Recht audit:view.', 'Sicherheit', 'MEDIUM', true, now(), 11),
  ('sec-firewall', 'Firewall/WAF (Signaturen, Rate-Limit, CSRF, IP-Ban, Header)', 'Mehrschichtige Application-Firewall inkl. Cockpit /firewall.', 'Sicherheit', 'HIGH', true, now(), 12),
  -- Erledigt (Features)
  ('feat-onboarding', 'Erstlogin-Assistent (2FA + Handy-Push, mit Test)', '/willkommen; erscheint direkt nach dem ersten Login.', 'Features', 'MEDIUM', true, now(), 20),
  ('feat-ntfy', 'Handy-Push (ntfy) vollständig + steuerbar', 'Alle Auslöser pushen; Konto-Checkliste je Gruppe.', 'Features', 'MEDIUM', true, now(), 21),
  ('feat-fixkosten', 'Fixkosten-Bereich (Umrechnung /Monat & /Jahr, Beleg-Upload)', '/finanzen/fixkosten.', 'Features', 'LOW', true, now(), 22),
  ('feat-chat', 'Interner Chat + Aufgaben-Fade + Superadmin-Aufgabensicht', 'Chat neben der Glocke, Tagging→Kommunikation.', 'Features', 'LOW', true, now(), 23),
  ('feat-avatar-crop', 'Profilbild positionieren (Kreis-Cropper)', 'Verschieben & Zoomen vor dem Upload.', 'Features', 'LOW', true, now(), 24),
  -- Offen (Sicherheit — aus dem Audit)
  ('sec-prompt-injection', 'MCP: untrusted CRM-Freitexte kennzeichnen', 'profileData/Notizen als <untrusted> markieren; Schreib-Tools mit Freigabe.', 'Sicherheit', 'MEDIUM', false, null, 40),
  ('sec-clientip-auth', 'auth.ts: clientIp()-Helper statt fälschbarem XFF[0]', 'Audit-IP & (deaktivierte) Login-Drossel an nicht-fälschbare IP binden.', 'Sicherheit', 'LOW', false, null, 41),
  ('sec-doc-attachment', 'Dokumente: content-disposition=attachment erzwingen', 'Nicht nur bei ?download=1 (Stored-HTML/SVG inline vermeiden).', 'Sicherheit', 'LOW', false, null, 42),
  ('sec-chat-get-csrf', '/api/chat: Lese-Markierung aus GET in POST verlagern', 'State-changing GET ist CSRF-anfällig.', 'Sicherheit', 'LOW', false, null, 43),
  ('sec-upload-magic', 'Upload-MIME per Magic-Byte prüfen (Fixkosten-Beleg)', 'Nicht nur dem Client-file.type vertrauen; Bilder re-encodieren.', 'Sicherheit', 'LOW', false, null, 44),
  ('sec-cron-bearer', 'CRON_SECRET nur per Authorization-Bearer', '?secret=-Query entfernen (Secret-Leak in Logs), timingsicher vergleichen.', 'Sicherheit', 'LOW', false, null, 45),
  ('sec-notif-create', 'Broadcast-Mitteilung an notifications:create binden', 'Senden ist Mutation, aktuell nur notifications:view.', 'Sicherheit', 'LOW', false, null, 46),
  ('sec-logout-audit', 'Logout im Audit-Log erfassen', 'recordAudit("session.logout") vor Cookie-Löschung.', 'Sicherheit', 'LOW', false, null, 47),
  ('sec-ki-intake-valid', 'KI-Intake: Extraktion vor Insert validieren', 'Katalog-/Längen-Prüfung wie updateJob (public.JobPosting).', 'Sicherheit', 'LOW', false, null, 48),
  ('sec-ki-cost-cap', 'KI-Kostendeckel & Rate-Limit', 'Tages-/Monatsdeckel + pro-Actor-Limit via ki_usage; KI-Master-Schalter.', 'Sicherheit', 'LOW', false, null, 49),
  ('sec-totp-encrypt', 'TOTP-Secrets verschlüsselt at rest (Entscheidung nötig)', 'AES-256-GCM mit Key aus separater ENV/KMS.', 'Sicherheit', 'LOW', false, null, 50),
  ('sec-session-absolute', 'Absolutes Session-Limit / erzwungenes Re-Auth (Entscheidung nötig)', 'z. B. nach 14–30 Tagen voller Re-Login inkl. 2FA.', 'Sicherheit', 'LOW', false, null, 51)
on conflict (slug) do nothing;
