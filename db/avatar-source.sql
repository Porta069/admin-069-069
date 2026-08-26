-- Profilbild nachträglich neu positionieren: neben dem zugeschnittenen Avatar
-- wird eine (nur verkleinerte, nicht beschnittene) Quell-Version + die letzte
-- Ausschnitt-Transformation gespeichert, damit der Kreis-Cropper das Bild
-- später erneut frei positionieren kann.
alter table admin.employee
  add column if not exists avatar_source_url text,
  add column if not exists avatar_crop jsonb;
