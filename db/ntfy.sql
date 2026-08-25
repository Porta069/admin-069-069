-- Handy-Push per ntfy: je Mitarbeiter ein geheimer, zufälliger Topic-Name.
-- Die ntfy-App auf dem Handy abonniert diesen Topic; das Backend pusht dorthin.
-- NULL = Handy-Benachrichtigungen aus.

alter table admin.employee
  add column if not exists ntfy_topic text;
