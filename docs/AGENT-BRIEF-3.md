# Addendum 3 — 9 neue Funktionen (Radar, KI-Assistent, Vorschläge, Finanzen, Analytics-Tiefe, Datenqualität, Reaktivierung, Betriebs-Health)

Gilt zusätzlich zu docs/AGENT-BRIEF.md, -2.md. Fundament steht bereits (Schema, KI-Basis, Radar im Sync-Runner). NICHT die gemeinsamen Dateien ändern.

## Wichtig: Token-Doktrin (gilt für ALLE KI-Nutzung)

Die meisten dieser Features brauchen KEINE KI — die Matching-Engine (`src/lib/matching/rank.ts`: `rankJobsForProfile`, `rankCandidatesForJob`) ist deterministisch und kostenlos. Nutze KI NUR im KI-Assistenten. Wenn du KI nutzt: ausschließlich über `src/lib/ki/index.ts`:
- `kiJson({feature, stufe, system, user, schema, maxTokens, actorId})` — Structured Output, Prompt-Caching automatisch, Verbrauch wird geloggt. `stufe`: "guenstig" (Haiku, für einfaches), "standard" (Sonnet), "premium" (Opus, selten).
- `cached(feature, eingabe, compute, ttl?)` — Ergebnis vorberechnen & wiederverwenden.
- `kiVerfuegbar()` — ohne Key sauberer Hinweis, kein Fehler.
System-Prompt = stabiler Teil (Anweisungen), User = variabler Teil. Kontext klein halten (nur Nötiges), nie den ganzen Katalog wenn ein Ausschnitt reicht.

## Neue Tabellen (admin.*)

- **admin.match_suggestion**: id, application_id, candidate_name, job_posting_id, job_title, company_id, company_name, match_score (int), richtung ('JOB_FUER_KANDIDAT'|'KANDIDAT_FUER_JOB'), status ('NEU'|'GESICHTET'|'VORGESCHLAGEN'|'VERWORFEN'), assignee_id, created_at, handled_at. Unique (application_id, job_posting_id). Wird vom Sync-Runner automatisch befüllt.
- **admin.proposal** (Vorschlags-/Angebots-Workflow): id, application_id, candidate_name, job_posting_id, job_title, company_id, company_name, employee_id, match_score, status ('VORGESCHLAGEN'|'BETRIEB_INTERESSIERT'|'ANGEBOT'|'ANGENOMMEN'|'ABGELEHNT'|'VERMITTELT'), betrieb_reaktion, offer_message, offer_at, decline_reason, created_at, updated_at, deleted_at.
- **admin.invoice** (Finanzen): id, nummer (unique), placement_id → admin.placement(id), company_id, company_name, base_fee_cents, commission_cents, total_cents, status ('OFFEN'|'BEZAHLT'|'UEBERFAELLIG'|'STORNIERT'), issued_at, due_at, paid_at, reminder_count, last_reminder_at, notes, created_by, created_at, updated_at, deleted_at. Rechnungsnummern via `nextval('admin.invoice_seq')` (start 1000), Format z. B. `RE-2026-1000`.
- **admin.merge_log**: id, entity_type, ziel_id, quelle_id, actor_id, detail (jsonb), created_at.
- **admin.ki_usage** / **admin.ki_cache**: von src/lib/ki verwaltet — nur lesen fürs KI-Verbrauchs-Panel.
- **admin.placement** neu: `match_score` (int, nullable).
- **admin.candidate_meta** neu: `verfuegbar_bestaetigt_am` (timestamptz).
- **admin.setting** key `radar`: `{schwelle: 75, top_n: 5}`.

## Bestehendes, das du nutzt

- Matching: `rankJobsForProfile(profileData)`, `rankCandidatesForJob(jobId)` aus `@/lib/matching/rank`. Profil eines Kandidaten: public."User" via lower(email)-Match zur Application, Feld "profileData".
- Preise: `admin.setting` key `pricing` {base_fee_cents 4900, max_commission_cents 250000, referral_reward_cents 10000}.
- Vermittlungen: admin.placement (jetzt mit match_score-Spalte).
- Pipeline-Statuswechsel stehen im admin.audit_log (action 'candidate.status_changed', metadata).

## Aufgaben je Agent

### Agent A — Radar-Seite, Automatik-Verdrahtung, Matching-Feedback
- **/radar** (module "matching"): DataTable/Liste der admin.match_suggestion (status NEU zuerst), Spalten: Kandidat (Link), Job (Link), Unternehmen, Match-Score (groß, tabular, farbcodiert), Richtung, zuständiger MA, erkannt am. Filter: Richtung, Status, Score-Schwelle. KPIs: neue Vorschläge, offen gesamt, Ø Score. Pro Zeile Aktionen: „Als Vorschlag übernehmen" (legt admin.proposal an, setzt suggestion.status='VORGESCHLAGEN', Audit), „Verwerfen" (status='VERWORFEN'). Bulk: übernehmen/verwerfen. Hinweis-Karte oben erklärt: „Das System erkennt neue Top-Matches automatisch bei jeder neuen Stelle/Registrierung." Schwelle/Top-N aus Einstellungen (nur anzeigen + Link zu /einstellungen, wo Agent … nein: füge in /radar einen kleinen Einstell-Dialog für schwelle/top_n hinzu, schreibt admin.setting.radar, Permission matching:manage).
- **Automatisierungen**: In src/app/(app)/automatisierungen/ die zwei bisher als „Folgt mit Matching-Engine" markierten Rezepte („Passender Job gefunden → Kandidat informieren", „Neuer Job → passende Kandidaten suchen") auf „Aktiv — läuft über das Matching-Radar" umstellen (die Logik läuft im Sync-Runner; hier nur Text/Badge + Verweis auf /radar).
- **Matching-Feedback** (in src/app/(app)/analytics/ eigener Abschnitt „Matching-Qualität"): Von den Vermittlungen mit gesetztem match_score: Verteilung (wie viele PLACED hatten >80/60–80/<60 %), Ø Score der Vermittelten, und „Trefferquote": Anteil der match_suggestion, die zu einer proposal/placement wurden. Alles deterministisch aus admin.placement + admin.proposal + admin.match_suggestion. Wenn placement.match_score meist leer ist: beim Anlegen einer Vermittlung (vermittlungen/actions.ts NICHT anfassen — stattdessen) den Score über die Engine nachtragen ist zu invasiv; nutze stattdessen proposal.match_score als Grundlage und erkläre die Datenlage ehrlich.

### Agent B — KI-Assistent (einziges echtes KI-Feature)
- **/assistent** (module null — jeder darf, aber Datenzugriff streng nach Rechten): Chat-artige Oberfläche. Eingabe + vorgeschlagene Beispiel-Prompts (aus deiner Spec §45: „Welche 10 Kandidaten passen zu Job X?", „Fasse den Kontakt mit Betrieb Y zusammen", „Welche Kandidaten muss ich diese Woche kontaktieren?", „Entwirf eine E-Mail an Kandidat Z").
- Architektur (Token-sparsam): Der Assistent löst die meisten Fragen DETERMINISTISCH — erkenne die Absicht regelbasiert/über eine günstige KI-Klassifikation und beantworte aus SQL/Matching-Engine, NICHT indem du alle Daten ins LLM kippst. Konkret umsetzbar:
  - Server Action `frageAssistent(frage)`: (1) Kandidat/Job/Unternehmen aus der Frage per einfachem Text-Match/ID-Erkennung + DB-Lookup finden; (2) die eigentliche Datenarbeit macht Code (Matching-Engine für „welche Kandidaten passen", SQL für „diese Woche kontaktieren" = offene Aufgaben/überfällige, Timeline-Zusammenfassung für „Kontakt mit Betrieb"); (3) NUR die finale Formulierung/Zusammenfassung geht über `kiJson`/`kiClient` mit Stufe "guenstig" und KLEINEM Kontext (die schon von Code gesammelten Fakten, nicht die Rohdaten).
  - Für „E-Mail entwerfen": kiJson Stufe "guenstig", Kontext = Kandidatenname + Anlass, Structured Output {betreff, text}.
  - WICHTIG: Berechtigungen — vor jedem Datenzugriff prüfen, ob der eingeloggte Mitarbeiter das Modul/den Datensatz sehen darf (hasPermission). Der Assistent darf nie Daten liefern, die der MA sonst nicht sieht. Jede Antwort mit Quellen-Links (zu Kandidat/Job/Unternehmen).
  - Ohne ANTHROPIC_API_KEY: die deterministischen Antworten (Listen, Matches, Kontakt-Zusammenfassung als Bulletpoints) funktionieren trotzdem; nur die „schön formulierten" Teile zeigen einen Hinweis.
- Verbrauchs-Transparenz: kleines Panel „KI-Nutzung" (aus admin.ki_usage: Aufrufe & Tokens letzte 7 Tage) unten auf der Seite, nur für Superadmin sichtbar.

### Agent C — Vorschläge/Angebote-Detail + Finanzmodul
- **/vorschlaege** (module "placements"): Liste admin.proposal (offene zuerst). Als aufklappbare Prozess-Ansicht ODER DataTable mit Status-Spalte. Der Lebenszyklus VORGESCHLAGEN → BETRIEB_INTERESSIERT → ANGEBOT → ANGENOMMEN/ABGELEHNT → VERMITTELT. Pro Zeile Statuswechsel-Dropdown (Server Action + Audit). Bei „ANGEBOT": Dialog mit offer_message → setzt offer_at. Bei „VERMITTELT": Dialog, der eine admin.placement anlegt (Kandidat/Unternehmen/Job aus der proposal, base_fee aus pricing, Provision eingebbar) UND proposal.match_score in placement.match_score überträgt + candidate_meta.status='VERMITTELT'. Bei „ABGELEHNT": decline_reason erfassen. KPIs: offene Vorschläge, im Angebot, Vermittlungsquote. „Vorschlag erstellen"-Dialog (Kandidat + Job wählen, Score via Engine ermitteln).
- **/finanzen** (module "rewards"): 
  - KPI-Zeile: Offener Betrag gesamt, überfällig, bezahlt (Monat), erwarteter Pipeline-Umsatz (= offene proposals in ANGEBOT/ANGENOMMEN × Ø-Provision + base_fee, grob — deterministisch).
  - Rechnungs-Tabelle (admin.invoice): Nummer, Unternehmen, Betrag (formatEuroCents total_cents), Status (StatusBadge), ausgestellt, fällig (rot wenn überfällig), bezahlt am. Filter Status.
  - „Rechnung aus Vermittlung erstellen"-Dialog: wählt eine admin.placement ohne Rechnung, erzeugt admin.invoice (nummer via nextval('admin.invoice_seq') → `RE-${jahr}-${seq}`, base_fee/commission/total aus placement, due_at = +14 Tage), Audit "invoice.created".
  - Aktionen je Rechnung: „Als bezahlt markieren" (status BEZAHLT, paid_at), „Mahnung" (reminder_count++, last_reminder_at, Status UEBERFAELLIG wenn über Fälligkeit — echter Versand nicht nötig, nur protokollieren + Hinweis „E-Mail-Versand folgt über die Outbox"), „Stornieren".
  - Rechnungs-PDF/Druckansicht: eine Route /finanzen/[id]/pdf ODER eine druckbare Detailseite (window.print) mit Rechnungslayout (Absender PORTAWERK, Empfänger Unternehmen, Position Grundgebühr + Erfolgsprovision, Summe, Zahlungsziel). Kein externes PDF-Lib nötig — sauber gestylte HTML-Seite mit @media print reicht.

### Agent D — Datenqualität/Dubletten, Reaktivierung, Betriebs-Health, Pipeline-Engpass
- **/datenqualitaet** (module "candidates"): Abschnitte mit KPI + Liste:
  - „Kandidaten ohne Matching-Profil": Applications (status<>ERASED), zu denen kein public."User" mit passendem profileData existiert oder das Profil leer ist (nutze extractProfile+profilIstLeer aus @/lib/matching/profile) — die tauchen in keinem Match auf. Link zum Kandidaten.
  - „Jobs ohne Kriterien": aktive JobPostings, deren gewichtsrelevante Kriterien (bereiche/berufe/aufgaben/erfahrung/…) alle leer sind (matchen 100% für jeden = nutzlos). Link zur Stelle + „Kriterien pflegen".
  - „Mögliche Dublette-Kandidaten": Applications mit gleicher/ähnlicher E-Mail oder gleichem Namen+PLZ. Pro Paar „Zusammenführen"-Aktion: die admin-Metadaten (candidate_meta, notes, tasks, tags → entity_id) vom Quell- auf den Ziel-Datensatz umhängen, merge_log schreiben, Audit. (Die Plattform-Application selbst NICHT löschen — nur die admin-Verknüpfungen zusammenführen und Quelle als INAKTIV markieren.)
  - „Mögliche Dublette-Unternehmen": Company mit gleichem Namen. Analog.
- **Reaktivierung** (Tab in src/app/(app)/kandidaten/ ODER eigener Abschnitt — mache es als zusätzlichen Filter/Tab „Reaktivierung" auf /kandidaten): Kandidaten, die (a) seit >30 Tagen keine Aktivität haben (Application.updatedAt alt, keine neue Aufgabe/Notiz/Kommunikation) UND (b) ein verwertbares Matching-Profil haben (also grundsätzlich vermittelbar). Sortiert nach bestem verfügbarem Match-Score. Aktion „Verfügbarkeit bestätigt" (setzt candidate_meta.verfuegbar_bestaetigt_am=now) und „Reaktivierungs-Aufgabe erstellen". Spalte „zuletzt bestätigt verfügbar".
- **Betriebs-Health** (Abschnitt in src/app/(app)/analytics/ ODER auf /unternehmen als KPI-Zeile — mach es als Abschnitt in analytics „Unternehmen"): je Unternehmen Health-Indikator aus: aktive Jobs, Bewerbungen letzte 30 Tage, letzte Aktivität, hatte Vermittlung? Kategorien Aktiv/Ruhend/Churn-Risiko (lange keine Aktivität). Und „Wiederholungsgeschäft": Unternehmen mit erfolgreicher Vermittlung, die aktuell keine offene Stelle haben → Follow-up-Kandidaten (Liste + „Aufgabe erstellen").
- **Pipeline-Engpass** (Abschnitt in analytics „Pipeline-Durchlauf"): aus admin.audit_log (action='candidate.status_changed') die durchschnittliche Verweildauer je Pipeline-Status berechnen (Zeit zwischen aufeinanderfolgenden Statuswechseln desselben Kandidaten), als horizontale Balken. Zeigt den Flaschenhals. Wenn zu wenig Audit-Daten: ehrlicher Hinweis „Datenbasis wächst mit der Nutzung".

## Regeln
Alle Briefing-Regeln (requireEmployee/requirePermission, recordAudit, Soft-Delete, deutsche UI, EmptyStates, serverseitige Pagination, formatEuroCents/formatDate). Am Ende `npx tsc --noEmit` für deine Dateien sauber. KEIN npm install, KEIN dev-Server, KEIN git. Antwort: kompakte Dateiliste + offene Punkte.
