-- HTML-Body für ausgehende E-Mails (optional). Ist er gesetzt, stellt der
-- Mailer HTML statt Plaintext zu (Brevo htmlContent / Resend html). Der
-- Plaintext-Body bleibt als Fallback für Clients ohne HTML erhalten.
alter table admin.outbox_email add column if not exists html text;
