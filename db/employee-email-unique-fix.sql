-- E-Mail-Eindeutigkeit NUR unter aktiven (nicht gelöschten) Konten — analog zum
-- Username-Index. Sonst blockieren E-Mails soft-gelöschter Mitarbeiter dauerhaft
-- die Wiederverwendung (Dublettenprüfung meldete „frei", Insert schlug aber fehl).
alter table admin.employee drop constraint if exists employee_email_key;
drop index if exists admin.employee_email_key;
create unique index if not exists employee_email_uidx
  on admin.employee (lower(email)) where deleted_at is null;
