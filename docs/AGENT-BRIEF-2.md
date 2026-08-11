# Addendum zu AGENT-BRIEF.md — Ausbaustufe 2

Gilt zusätzlich zu docs/AGENT-BRIEF.md (zuerst lesen!). Neue Infrastruktur:

## Neue Tabellen (admin.*)

- **admin.campaign**: id, name, subject, body, audience (jsonb, z. B. {"typ":"kandidaten","bundesland":"…","beruf":"…","status":"…","verifiziert":true}), status (DRAFT|SCHEDULED|SENDING|SENT|CANCELLED), scheduled_at, created_by, recipient_count, sent_count, created_at, updated_at, deleted_at
- **admin.outbox_email**: id, campaign_id, to_email, to_name, subject, body, entity_type/id, kind (CAMPAIGN|SYSTEM|AUTOMATION), status (PENDING|SENT|FAILED|SKIPPED), error, created_at, sent_at
- **admin.automation_run**: id, automation_id, trigger, matched, actions_done, detail, created_at
- **admin.sync_state**: key, last_run, cursor
- **admin.employee** neu: must_change_password, totp_secret, totp_enabled, ical_token

## Neue Libs

- `src/lib/mailer.ts`: `mailerConfigured()` (false solange kein RESEND_API_KEY+EMAIL_FROM gesetzt), `queueEmail({...})` legt PENDING-Outbox-Zeile an, `renderTemplate(text, vars)` ersetzt {first_name} {last_name} {company} {job_title}, `processOutbox()`.
  **WICHTIG UI-Regel:** Wenn `mailerConfigured() === false`, überall klaren Hinweis zeigen: „E-Mail-Provider noch nicht verbunden — Mails werden in der Outbox gesammelt und nach dem Verbinden automatisch versendet." Kampagnen-Versand trotzdem erlauben (Status SENDING, Outbox PENDING).
- `src/lib/storage.ts`: `createSignedDocumentUrl(storageKey, expiresInSeconds?)` → signierte URL für den Dokumente-Bucket oder null.
- `src/lib/sync.ts`: läuft automatisch (nicht manuell aufrufen). Unterstützte Automation-Trigger: NEW_CANDIDATE (Aktion SEND_TEMPLATE mit templateId), APPLICATION_STALE (CREATE_TASK), INTERVIEW_UPCOMING (Erinnerung automatisch). Runs stehen in admin.automation_run.
- DataTable hat jetzt automatisch „Ansichten" (gespeicherte Ansichten pro tableId) — nichts zu tun.
- CSV: Route Handler unter src/app/api/export/... selbst bauen (Content-Type text/csv; charset=utf-8, BOM ﻿ voranstellen für Excel, Semikolon als Trenner, deutsche Header).

## Sonstiges

- Berlin-Zeit-Parsing für datetime-local: `parseBerlinLocal` aus `@/lib/format`.
- Neue Nav-Route existiert bereits: /kampagnen (module "communication").
- Audit- und Permission-Regeln unverändert aus AGENT-BRIEF.md.
