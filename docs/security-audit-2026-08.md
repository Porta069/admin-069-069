# Security-Audit — Admin-Dashboard + MCP-Server

Automatisiertes, verifiziertes Audit (Multi-Agent). 29 Befunde.

## [P1] Voll-Admin-Token wird als ?key= in der URL akzeptiert (Secret-Leak über Logs/Referrer/Proxy)
- Ort: `src/app/api/mcp/route.ts:578` · CONFIRMED · ggf. Funktionsänderung · Aufwand S
- Szenario: Ein Connector oder Angreifer ruft /api/mcp?key=<MCP_SECRET> auf (autorisiert() akzeptiert in Zeile 578-579 key===secret). Das Secret landet in Vercel-/Reverse-Proxy-Access-Logs, Browser-History, Referer-Headern und CDN-Logs. Wer eines dieser Logs lesen kann, erhält den Klartext-Token und damit VOLLEN Lese-/Schreibzugriff auf die gesamte DB (sql_abfrage/sql_schreiben) inkl. Kandidatendaten, Passwort-Hashes und 2FA-Secrets.
- Fix: ?key= entfernen und ausschließlich den Authorization-Header verwenden; falls der claude.ai-Connector zwingend Query braucht, ein kurzlebiges, zweckgebundenes Rotations-Token nutzen und das Query-Secret serverseitig redacten.

## [P1] Readonly-SQL-Guard blockt nur DML-Keywords, nicht gefährliche Funktionen (pg_read_file/lo_*/set_config/pg_sleep)
- Ort: `src/app/api/mcp/route.ts:49` · CONFIRMED · funktionserhaltend · Aufwand M
- Szenario: pruefeReadonlySql (Zeile 44-56) prüft nur führendes SELECT/WITH plus eine Keyword-Denyliste. Verifiziert: 'select set_config(role,postgres,false)' umgeht \bset\b, weil auf 'set' ein Unterstrich folgt und _ ein Wortzeichen ist (keine Wortgrenze) → kein Match. 'select pg_sleep(120)' passiert den Guard und blockiert eine Poolverbindung bis maxDuration. 'select pg_read_file(...)'/'select lo_get(...)'/'select * from pg_ls_dir(.)' sind ebenfalls nicht erfasst und lesen — sofern die DB-Rolle die Rechte hat — Serverdateien. Die Abfrage wird als Subquery gewrappt (Zeile 557), was pg_sleep/set_config als gültige SELECTs durchlässt.
- Fix: Statt Denyliste echte Read-Only-Durchsetzung auf DB-Ebene: READ ONLY-Transaktion mit statement_timeout und minimal berechtigter, auf Anwendungsschemata beschränkter DB-Rolle (kein pg_read_file/lo_*/dblink, kein Zugriff auf Systemschemata). Zusätzlich pg_read_file/lo_*/pg_ls_dir/dblink/set_config/pg_sleep explizit sperren.

## [P1] sql_abfrage erlaubt uneingeschränktes Lesen von Geheimnis-Spalten (password_hash/totp_secret/token_hash/ical_token)
- Ort: `src/app/api/mcp/route.ts:556` · CONFIRMED · ggf. Funktionsänderung · Aufwand M
- Szenario: Der Token-Inhaber (oder wer den geleakten ?key=-Token hat) ruft sql_abfrage mit z. B. 'select email, password_hash, totp_secret from public."User"'. Da sql.unsafe die Abfrage nur in 'select * from (…) _mcp limit 200' wrappt (Zeile 556-558) und der Guard keinerlei Spalten-/Tabellen-Allowlist kennt, fließen Passwort-Hashes, 2FA-Secrets sowie Reset-/iCal-/API-Token aus beliebigen admin.*/public.*-Tabellen ab → Massen-Exfiltration und Kontoübernahme.
- Fix: Geheimnis-Spalten über eine restriktive DB-Rolle (Column-Privileges) oder Views ausschließen bzw. sql_abfrage nur auf freigegebene, secret-freie Views/Schemata zulassen; Auth-Felder gar nicht exponieren.

## [P2] Admin-Passwort-Reset widerruft die Sitzungen des Zielkontos nicht
- Ort: `src/app/(app)/mitarbeiter/actions.ts:356` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Konto X ist kompromittiert; Angreifer hat eine gueltige pw_session (rollierend bis 24h). Ein Admin ruft resetEmployeePassword(X) auf: password_hash wird neu gesetzt und must_change_password=true (356-359), aber KEIN update admin.session set revoked_at=now() where employee_id=X (anders als setEmployeeStatus:322-325 und deleteEmployee:390-391). getEmployee (auth.ts:320-331) prueft nur revoked_at/expires_at/status, nicht den Passwortwechsel. Die Angreifer-Session bleibt gueltig; getEmployee-basierte /konto-Actions (me()) umgehen das requirePermission-mustChangePassword-Gate, sodass Lese-/Selbstverwaltungs-Zugriff bis zum 24h-Ablauf bestehen bleibt.
- Fix: Nach dem Hash-Update `update admin.session set revoked_at=now() where employee_id=${employeeId} and revoked_at is null` ergaenzen (analog Zeile 322-325).

## [P2] updateTemplate prueft nur das neue, nicht das bestehende Rollen-Level
- Ort: `src/app/(app)/rollen/actions.ts:122` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Ein Nicht-Master mit roles:edit und roleLevel=80 oeffnet ein bestehendes, hoeher gestuftes Nicht-Master-Template (z.B. level=95). pruefeUmfang(actor, input.level, map) an Zeile 122 validiert ausschliesslich den EINGEHENDEN Level und die eingehende Map gegen den Actor; das in Zeile 94 geladene role.level wird nie geprueft. Der Actor setzt input.level=79 und eine Map aus eigenen Rechten — die Pruefung passt. Das UPDATE (125-129) ueberschreibt Level und permissions der Rolle 95. Alle Mitarbeiter mit dieser Rolle fallen auf Level 79 und erhalten die vom Actor gesetzten Rechte (Integritaets-/Downgrade-Angriff gegen Vorgesetzte, veraendert deren Escalation-Level).
- Fix: Vor der Bearbeitung fuer Nicht-Master `if (role.level >= actor.roleLevel) return {ok:false,...}` erzwingen; role.level wird bereits in Zeile 94 geladen.

## [P2] Kein TOTP-Replay-Schutz (verbrauchte Codes werden nicht invalidiert)
- Ort: `src/lib/security.ts:20` · CONFIRMED · funktionserhaltend · Aufwand M
- Szenario: verifyTotp (20-33) validiert via otplib, speichert aber keinen zuletzt verbrauchten Zaehler/Zeitstempel. Ein einmal beobachteter 6-stelliger Code (Phishing-Proxy, Schulterblick, Malware am Step-up-Prompt) laesst sich innerhalb des Gueltigkeitsfensters (~30s) mehrfach wiederverwenden — sowohl fuer den zweiten Login-Faktor (auth.ts:231) als auch fuer verifyStepUp (step-up.ts:32) zur Freigabe sicherheitskritischer Bezahl-Variablen.
- Fix: Letzten akzeptierten TOTP-Counter/Zeitfenster je employee in der DB speichern (z.B. totp_last_step) und Codes ablehnen, deren Schritt <= zuletzt verbrauchtem Schritt ist.

## [P2] Zweiter Faktor ohne kontobezogenes Rate-Limit brute-force-bar
- Ort: `src/lib/auth.ts:241` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Bei korrektem Passwort und falschem TOTP-Code wird der Fehlversuch zwar in login_event geloggt (236-238), login() kehrt aber bei 241-247 mit needsTotp zurueck BEVOR istEmailGesperrt (250) erreicht wird — diese Konto-Sperre greift nur im Zweig mit falschem Passwort. Ein Angreifer mit bekanntem Passwort (Leak/Reuse) kann TOTP-Codes durchprobieren, ohne dass die 5-Versuch-Kontosperre je greift; nur die globale IP-Drossel (20/15min) begrenzt, die per IP-Rotation/Proxy umgehbar ist.
- Fix: Im needsTotp-Fehlerpfad ebenfalls eine kontobezogene Attempt-Sperre (istEmailGesperrt) pruefen bzw. fehlgeschlagene TOTP-Versuche gesondert je Konto zaehlen und ab Schwelle blocken.

## [P2] 2FA-Selbst-Enrollment bindet Geraet an blossen Passwortbesitz (Pre-2FA-Takeover)
- Ort: `src/lib/auth.ts:178` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: Neue Konten werden mit must_change_password=true und ohne 2FA angelegt (mitarbeiter/actions.ts:149-155) bzw. via resetEmployeePassword mit Klartext-Passwort. Solange totp_enabled=false ist, fuehrt login() bei korrektem Passwort die 2FA-Selbst-Einrichtung durch (178-225): Secret erzeugen/wiederverwenden, QR ausgeben, nach erstem gueltigen Code totp_enabled=true und Fall-through in den regulaeren Login. Ein Angreifer mit geleaktem/Initial-Passwort registriert vor dem Opfer SEIN eigenes Authenticator-Geraet, schliesst den Login ab und kann anschliessend (Passwort bekannt) das erzwungene Passwort aendern — vollstaendige Kontouebernahme inkl. dauerhaftem zweiten Faktor.
- Fix: Erst-Enrollment an den erzwungenen Passwortwechsel koppeln und/oder E-Mail-Benachrichtigung + Bestaetigung beim Aktivieren des ersten 2FA-Geraets; optional admin-initiiertes Enrollment.

## [P2] Rollenvergabe prueft nur Hierarchie-Level, nicht Rechte-Subset -> Privilege Escalation ueber Passwort/Reset
- Ort: `src/app/(app)/mitarbeiter/actions.ts:49` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: Ein Handelnder mit employees:create/edit auf mittlerem Level (z.B. roleLevel 80), dem selbst das Modul 'rewards' fehlt, legt via createEmployee ein Konto mit einer niedrigeren Rolle (level<80) an, deren Template 'rewards:manage' enthaelt. darfRolleVergeben() (Zeile 49-56) erlaubt das, weil es NUR das Level vergleicht (Zeile 55) und die von ladeRolle mitgeladenen permissions ignoriert. Bei generatePassword=true erhaelt der Handelnde direkt das Klartext-Passwort (Zeile 164); alternativ ruft er resetEmployeePassword() auf (durch darfVerwalten level-check gedeckt) und bekommt Klartext (Zeile 365). Login als dieses Konto -> er besitzt nun 'rewards', ein Modul, das ihm selbst fehlt. changeEmployeeRole hat dieselbe Luecke.
- Fix: In darfRolleVergeben() zusaetzlich role.permissions laden und permissionsSubsetOf(role.permissions, actor.permissions) verlangen (Master via isFullAccess ausgenommen); analog in createEmployee/changeEmployeeRole vor Insert/Update. resetEmployeePassword sollte keinen Klartext an Konten mit gleichwertigen/hoeheren Effektivrechten ausgeben.

## [P2] Stored XSS: E-Mail-Vorschau-iframe im Vorlagen-Editor ohne sandbox (same-origin Script-Ausfuehrung)
- Ort: `src/app/(app)/belege/_components/vorlagen-editor.tsx:360` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Mitarbeiter A (Recht communication:edit) oeffnet /belege/[key] und setzt im Feld 'hervorhebung' zwei Zeilen: Zeile 1 'Jetzt oeffnen', Zeile 2 'https://e" onmouseover="fetch(location.origin+'/api/...',{method:'POST'})'. hervorhebungBlock() (email-templates.ts:72-82) erkennt die letzte Zeile via isUrl() als URL und ruft button(last,label). button() gibt die URL als href="${esc(url)}" aus (Zeile 51); esc() (Zeile 35-36) escaped NUR & < >, nicht ", d. h. der Wert bricht aus dem href-Attribut aus und injiziert ein onmouseover-Attribut in das <a>. saveVorlage speichert die Vorlage global. Oeffnet Mitarbeiter B dieselbe Vorlage, laedt der gespeicherte Wert in den text-State und emailHtml (renderVorlageEmail().html) wird in ein iframe mit srcDoc OHNE sandbox gerendert (Zeile 360-364). Verifiziert: die beiden Schwester-Vorschauen nutzen korrekt sandbox="" (lead-actions.tsx:272, candidate-actions.tsx:734/864) - genau dieser iframe nicht. srcDoc erbt den Dashboard-Origin, beim Hover/Klick auf den CTA laeuft der injizierte JS same-origin mit Bs Session und kann Server-Actions/Admin-APIs im Namen von B aufrufen.
- Fix: Dem iframe in Zeile 360 sandbox="" geben (identisch zu lead-actions.tsx/candidate-actions.tsx) UND esc() in email-templates.ts um .replace(/"/g,'&quot;').replace(/'/g,'&#39;') erweitern. Beides funktionserhaltend, da die Vorschau reines Anzeige-HTML ist und legitime URLs keine rohen Anfuehrungszeichen enthalten.

## [P2] sql_schreiben erlaubt Rechteausweitung und Manipulation der Kontrollebene (Mitarbeiter-Rolle, MCP-Pause, Audit)
- Ort: `src/app/api/mcp/route.ts:468` · CONFIRMED · funktionserhaltend · Aufwand M
- Szenario: sql_schreiben (Zeile 464-483) blockt nur Strukturbefehle (DROP/TRUNCATE/ALTER/GRANT/CREATE …), erlaubt aber jedes INSERT/UPDATE/DELETE auf JEDER Tabelle. Damit bei aktivem Schreibzugriff: 'update admin.employee set role_id=… where …' (Selbst-Hochstufung), 'delete from admin.mcp_log …' (Spurenverwischung, ist selbst ein WRITE-Tool und daher erlaubt) oder Manipulation von admin.setting-Werten. Kein Ziel-Tabellen-Schutz.
- Fix: Sicherheitskritische Tabellen (admin.setting, admin.employee, admin.role, admin.audit, admin.mcp_log) für die MCP-DB-Rolle schreibgeschützt machen bzw. in sql_schreiben per Ziel-Tabellen-Allowlist begrenzen; Pause/Write-Flags außerhalb der über MCP beschreibbaren Fläche halten.

## [P2] Kein Rate-Limit / DoS: authentifizierte Sleep-/Heavy-Queries erschöpfen den 5er-DB-Pool
- Ort: `src/app/api/mcp/route.ts:21` · CONFIRMED · funktionserhaltend · Aufwand M
- Szenario: Kein Rate-Limit, kein statement_timeout. In db.ts ist max:5 gesetzt (globaler Pool, vom gesamten Dashboard genutzt). Da pg_sleep den Readonly-Guard passiert, belegen fünf parallele sql_abfrage-Aufrufe mit 'select pg_sleep(120)' (maxDuration=120, Zeile 21) alle Verbindungen für zwei Minuten; das Dashboard bleibt ohne DB-Verbindungen. Schwere Cross-Joins laufen serverseitig ungebremst (nur die Ausgabe wird auf 200 Zeilen begrenzt).
- Fix: statement_timeout pro MCP-Query (z. B. 5-10 s) setzen, pg_sleep sperren, dedizierten kleinen Pool für MCP verwenden und pro Token ein Rate-Limit einführen.

## [P2] email_senden ermöglicht beliebigen Mailversand von verifizierter Domain (Phishing/Spam)
- Ort: `src/app/api/mcp/route.ts:513` · CONFIRMED · ggf. Funktionsänderung · Aufwand M
- Szenario: Mit dem MCP-Token (bzw. dem über ?key= geleakten Token) sendet email_senden markengetreue E-Mails an jede beliebige Adresse. Zeile 513 zeigt 'if (sofort_senden !== false)' → Default sofort_senden über processOutbox(5) inline zugestellt. Keine Empfänger-Allowlist, keine Mengenbegrenzung. Ein Angreifer verschickt Phishing/Spam mit Porta-Jobs-Branding vom verifizierten Absender → hohe Glaubwürdigkeit, Reputationsschaden der Sende-Domain.
- Fix: Versand-Tool per Default nur einreihen (sofort_senden default false + manuelle Freigabe), Empfänger auf im CRM bekannte Adressen beschränken, tägliches Sendelimit und Approval-Schritt einführen.

## [P2] MCP-Vollzugriffs-Secret per URL-Query (?key=) akzeptiert — Secret-Leak in Logs/History
- Ort: `src/app/api/mcp/route.ts:578` · CONFIRMED · ggf. Funktionsänderung · Aufwand M
- Szenario: autorisiert() (mcp/route.ts:573-580) akzeptiert MCP_SECRET nicht nur im Authorization-Header (:577), sondern auch als ?key=<MCP_SECRET> in der URL (:578-579). Der /api/mcp-Endpunkt ist aus dem proxy-Matcher ausgenommen (src/proxy.ts:38) und damit ohne Session-Redirect erreichbar. Der MCP-Server bietet sql_schreiben (:456-468, erlaubt beliebiges insert/update/delete via :468) und sql_abfrage (:544ff, voller Lesezugriff auf admin.* und public.*) plus E-Mail-Versand — also vollen Admin-Lese-/Schreibzugriff auf die gesamte DB. URL-Query-Parameter landen in Vercel-Access-Logs, Reverse-Proxy-Logs, Browser-History und potenziell im Referer-Header. Wer Log-Zugriff erlangt, liest das Secret im Klartext und erhält vollständigen Zugriff auf alle Kandidaten-, Finanz- und Mitarbeiterdaten.
- Fix: Privilegierte Autorisierung nur über den Authorization-Header zulassen; falls die Query-Variante fuer claude.ai-Connectoren bleiben muss, ein separates Nur-Lese-Secret dafuer verwenden und den Vergleich constant-time (crypto.timingSafeEqual) durchfuehren. Zusaetzlich MCP_SECRET rotieren.

## [P2] Keine Security-Response-Header (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Ort: `next.config.ts:3` · CONFIRMED · funktionserhaltend · Aufwand M
- Szenario: next.config.ts (:1-7) enthaelt kein headers(); vercel.json enthaelt nur regions und crons, keinen headers-Block. Ein Grep ueber src/, next.config.ts, vercel.json findet keinerlei Content-Security-Policy, Strict-Transport-Security, X-Frame-Options oder frame-ancestors. Ein Angreifer kann das Admin-Dashboard in einen unsichtbaren iframe einbetten (Clickjacking) und einen eingeloggten Mitarbeiter zu destruktiven Klicks (Loeschaktionen, Freigaben) verleiten. Ohne HSTS ist bei erstem HTTP-Aufruf ein SSL-Strip-/MITM-Angriff moeglich; ohne CSP wird etwaiges XSS ungebremst verstaerkt.
- Fix: In next.config.ts eine async headers()-Funktion ergaenzen, die fuer alle Pfade mindestens X-Frame-Options: DENY (bzw. CSP frame-ancestors 'none'), Strict-Transport-Security (max-age>=15552000; includeSubDomains), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin und eine restriktive CSP setzt.

## [P3] 2FA-Selbst-Enrollment im Login bindet Angreifer-Geraet bei bekanntem Passwort
- Ort: `src/lib/auth.ts:178` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: Fuer ein neu angelegtes Konto (must_change_password=true, totp noch nicht eingerichtet) fuehrt der Login bei korrektem Passwort direkt durch die 2FA-Selbsteinrichtung (Zeile 178-225): Wer das Initial-/geleakte Passwort kennt (bei createEmployee wird es dem Anleger im Klartext ausgehaendigt), scannt den ausgelieferten QR-Code mit dem EIGENEN Authenticator, bestaetigt den Code und aktiviert damit 2FA fuer sein Geraet (totp_enabled=true, Zeile 220-222). Der legitime Besitzer ist ausgesperrt, der Angreifer hat vollen Zugang. 2FA bietet hier keinen Schutz gegen Passwort-Kompromittierung vor der Ersteinrichtung (TOFU).
- Fix: Ersteinrichtung von 2FA aus einem separaten, protokollierten Konto-Setup-Flow (nach erzwungener Passwortaenderung) statt aus dem anonymen Login; optional Benachrichtigung an die hinterlegte E-Mail bei 2FA-Aktivierung.

## [P3] Verwaltungs-Autorisierung an Rollen-Level statt effektiver Override-Rechte
- Ort: `src/app/(app)/mitarbeiter/actions.ts:43` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: darfVerwalten (43-46) und ladeZiel bewerten nur r.level (Rollen-Level) und ignorieren permission_overrides bei der Escalation-Entscheidung (ladeZiel laedt overrides zwar mit, nutzt sie aber nur fuers UI). Ein hoher Manager vergibt einem Konto mit niedrigem Basisrollen-Level breite Custom-Rechte (subset-geprueft). Ein mittelstufiger Actor, der nur den niedrigen Rollen-Level uebertrifft, darf dieses effektiv maechtige Konto verwalten: resetEmployeePassword(Ziel) -> Klartext-Passwort -> Uebernahme eines Kontos mit Rechten, die der Actor selbst nicht besitzt (laterale Rechteausweitung).
- Fix: Bei Konten mit permission_overrides zusaetzlich pruefen, dass der Actor die effektiven Rechte des Ziels dominiert (permissionsSubsetOf(targetEffektiv, actor.permissions)), bevor verwaltet werden darf.

## [P3] IP-Drossel und login_event.ip aus ungeprueftem X-Forwarded-For
- Ort: `src/lib/auth.ts:110` · PLAUSIBLE · funktionserhaltend · Aufwand S
- Szenario: requestMeta liest ip = x-forwarded-for.split(',')[0] direkt aus dem Header ohne Trust-Boundary. Falls die App nicht hinter einem Header-sanitisierenden Proxy laeuft (bzw. bei Fehlkonfiguration), kann ein Angreifer die linkeste XFF-Position frei setzen, damit die per-IP-Drossel istIpGesperrt (20/15min) umgehen (jede Anfrage andere Pseudo-IP) und zugleich login_event.ip faelschen (Audit/Enumerationsschutz untergraben). Auf Vercel wird XFF plattformseitig gesetzt, daher niedrige Confidence — der Code trifft aber keine eigene Vertrauensannahme.
- Fix: Auf plattform-vertrauenswuerdige Client-IP zuruecksetzen (Vercel-IP-Ableitung bzw. nur bei bekannter Proxy-Kette akzeptieren) und die Annahme im Code dokumentieren.

## [P3] Schwache Passwortrichtlinie bei Selbst-Passwortwechsel
- Ort: `src/app/(app)/konto/actions.ts:39` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: changePasswordAction prueft nur newPassword.length < 10 (39-44), ohne die in mitarbeiter/actions.ts (passwortSchwach: Buchstabe+Ziffer) genutzte Mindestkomplexitaet. Ein Mitarbeiter kann sein Passwort auf ein triviales 10-Zeichen-Passwort ('aaaaaaaaaa') setzen, was das Brute-Force-/Guessing-Risiko fuer die erste Faktorstufe erhoeht.
- Fix: Dieselbe passwortSchwach-Regel (Laenge + Buchstabe + Ziffer) in changePasswordAction wiederverwenden.

## [P3] Destruktives revokeSession nur durch Lese-Recht audit:view geschuetzt
- Ort: `src/app/(app)/audit/actions.ts:24` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Ein Mitarbeiter mit lediglich audit:view (read-only) ruft revokeSession(tokenHash) fuer beliebige fremde Sitzungen auf (Token-Hashes sind auf der /audit-Seite sichtbar). Die eigene Sitzung ist zwar geschuetzt (Zeile 29-38), fremde jedoch nicht - er kann alle Kollegen wiederholt zwangsweise ausloggen (Availability/DoS). Die mutierende update ... set revoked_at (Zeile 50-52) steht hinter einem reinen View-Recht.
- Fix: requirePermission('audit','manage') (oder ein dediziertes 'edit') fuer revokeSession verlangen und das Recht nur an Session-Administratoren vergeben.

## [P3] Server Action getMcpConfig ohne Berechtigungspruefung (Info-Leak)
- Ort: `src/app/(app)/einstellungen/ki/actions.ts:15` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: Jeder Aufrufer der exportierten 'use server'-Action getMcpConfig() (Zeile 15) - unabhaengig vom settings-Modul - liest die MCP-Konfiguration (aktiv/schreiben) aus. Die Funktion enthaelt keinerlei getEmployee/requirePermission-Check, waehrend die Setter setMcpAktiv/setMcpSchreiben korrekt mit requirePermission('settings','edit') gegatet sind.
- Fix: Am Anfang von getMcpConfig requirePermission('settings','view') (oder mind. getEmployee) erzwingen; die interne saveMcpConfig-Nutzung durch die bereits gegateten Setter bleibt unberuehrt.

## [P3] frageAssistent umgeht Pflicht-Gate mustChangePassword
- Ort: `src/app/(app)/assistent/actions.ts:202` · PLAUSIBLE · funktionserhaltend · Aufwand S
- Szenario: Ein Konto mit gesetztem mustChangePassword (Initial-Passwort, noch nicht geaendert) besitzt nach dem Login eine gueltige Sitzung (login gibt ok:true trotz mustChangePassword zurueck). Seiten leiten via requireEmployee auf /konto um, aber frageAssistent nutzt nur getEmployee() (Zeile 202) und spiegelt die in requirePermission (auth.ts Zeile 406) enthaltene harte mustChangePassword-Durchsetzung NICHT. Das Konto kann die Action daher direkt aufrufen und Kandidaten-/Unternehmens-/Job-Daten (im Rahmen seiner eigenen Modul-Rechte via can()) auslesen, bevor das Initial-Passwort geaendert wurde.
- Fix: In frageAssistent nach getEmployee das mustChangePassword-Gate spiegeln (ablehnen) oder eine gemeinsame Guard-Funktion nutzen; konto-Actions bleiben bewusst ausgenommen.

## [P3] esc() escaped keine Anfuehrungszeichen -> HTML-Attribut-Injection im E-Mail-href
- Ort: `src/lib/email-templates.ts:51` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: In button() wird die URL als href="${esc(url)}" ausgegeben (Zeile 51); esc() (Zeile 35-36) escaped nur & < >, nicht " oder '. Ein in 'hervorhebung' (oder via substituteVars eingesetzter {{var}}-Wert) mit einem " erzeugt eine Attribut-Ausbruch-Injektion (z. B. onmouseover/onclick). In den candidate-/lead-Vorschauen ist der iframe sandboxed und echte Mail-Clients strippen Skripte, daher hier nur mittelbar/als Haertung relevant - der voll ausnutzbare Pfad ist die unsandboxte Vorschau (siehe P2-Finding). Verifiziert: esc('https://e" onmouseover="alert(1)') liefert href="https://e" onmouseover="alert(1)".
- Fix: esc() um .replace(/"/g,'&quot;').replace(/'/g,'&#39;') ergaenzen; funktionserhaltend, da nur reiner Text/Attributwerte betroffen sind.

## [P3] MCP sql_abfrage: Readonly-Guard ist eine Blocklist (SELECT-only per Wortliste, nicht wasserdicht)
- Ort: `src/app/api/mcp/route.ts:44` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: pruefeReadonlySql() (Zeile 44-56) erlaubt SELECT/WITH und blockt DML/DDL nur ueber eine Wort-Blocklist; die Abfrage wird als sql.unsafe(`select * from (${abfrage}) _mcp limit 200`) ausgefuehrt (Zeile 556-558). Der Zugriff ist per MCP_SECRET voll-privilegiert (arbitraeres SELECT by-design), aber die Blocklist deckt gefaehrliche Lese-/Nebeneffekt-Funktionen nicht ab (pg_read_file, pg_ls_dir, lo_import, dblink/postgres_fdw - verifiziert: keine davon in der Regex). Bei installierten Extensions/ausreichenden DB-Rollenrechten liesse sich damit ueber den reinen DB-Inhalt hinaus lesen (OS-Dateien) bzw. SSRF via dblink ausloesen; DML bleibt durch Blocklist + Semikolon-Verbot verwehrt. Exploitierbarkeit haengt von DB-Rolle/Extensions ab -> PLAUSIBLE.
- Fix: Abfrage in einer Transaktion mit `set transaction read only` bzw. ueber eine dedizierte read-only-DB-Rolle ausfuehren; die Wort-Blocklist nur ergaenzend behalten. Funktionserhaltend fuer legitime SELECTs.

## [P3] Token-Vergleich nicht zeitkonstant (Timing-Seitenkanal)
- Ort: `src/app/api/mcp/route.ts:577` · PLAUSIBLE · funktionserhaltend · Aufwand S
- Szenario: autorisiert() vergleicht den Token mit === (Zeile 577: auth === `Bearer ${secret}`, Zeile 579: key === secret). JS-Stringvergleich bricht beim ersten abweichenden Zeichen ab, theoretisch ein Timing-Orakel auf den Token. Über das Netzwerk stark verrauscht und bei langem Zufalls-Secret praktisch schwer, aber die Prüfung ist nachweislich nicht zeitkonstant.
- Fix: crypto.timingSafeEqual über gleich lange Buffer (nach Längen-/Präfix-Check) verwenden.

## [P3] Audit-Protokoll ist Best-Effort und Pause-Prüfung ist TOCTOU (Log-/Gate-Umgehung)
- Ort: `src/app/api/mcp/route.ts:87` · PLAUSIBLE · funktionserhaltend · Aufwand M
- Szenario: protokoll() (Zeile 84-90) fängt jeden Fehler mit leerem catch {} ab, sodass ein WRITE-Tool auch dann ausgeführt wird, wenn der Log-Insert scheitert (z. B. mcp_log nicht verfügbar) — Aktionen ohne Audit-Spur. Zusätzlich liest reg() (Zeile 99) zuerst mcpConfig() und führt danach das Tool aus (Zeile 109); wird zwischen Lesen und Ausführen pausiert/Schreiben gesperrt, läuft der bereits gestartete Aufruf dennoch durch (Race). Kein atomares Gate zwischen Freigabeprüfung, Ausführung und Protokoll.
- Fix: Sicherheitskritische Aktionen nur ausführen, wenn der Log-Eintrag erfolgreich geschrieben wurde (fail-closed), und Freigabe-Flag plus Protokoll in einer Transaktion mit der Schreibaktion prüfen/schreiben.

## [P3] Cron-Endpunkt per faelschbarem User-Agent ausloesbar (Auth-Bypass)
- Ort: `src/app/api/cron/sync/route.ts:14` · CONFIRMED · funktionserhaltend · Aufwand S
- Szenario: GET /api/cron/sync gilt als autorisiert, sobald der User-Agent mit 'vercel-cron/' beginnt (:13-16, Zweig :14). Der Pfad ist aus dem proxy-Matcher ausgenommen (src/proxy.ts:38) und damit oeffentlich erreichbar. Jeder Unauthentifizierte kann `curl -H 'User-Agent: vercel-cron/1.0' https://<host>/api/cron/sync` senden und so runSyncThrottled() (maxDuration 120s, zieht Daten vom Backend, erzeugt Aufgaben, verarbeitet Automationen) ausloesen. Da der User-Agent trivial faelschbar ist, ist die CRON_SECRET-Absicherung umgehbar; Auswirkung wegen Throttling primaer Ressourcenverbrauch/ungewollte Sync-Laeufe.
- Fix: Den User-Agent-Zweig entfernen und nur den CRON_SECRET-Vergleich behalten — Vercel-Cron sendet bei gesetztem CRON_SECRET automatisch 'Authorization: Bearer <CRON_SECRET>'; diesen Header constant-time pruefen.

## [P3] Secret-Vergleiche nicht constant-time (MCP & Cron)
- Ort: `src/app/api/mcp/route.ts:577` · PLAUSIBLE · funktionserhaltend · Aufwand S
- Szenario: Die Secret-Pruefungen verwenden `===` (mcp/route.ts:577 auth === `Bearer ${secret}`, :579 key === secret; cron/sync/route.ts:16 searchParams.get('secret') === process.env.CRON_SECRET). String-Vergleich mit `===` bricht beim ersten abweichenden Zeichen ab und ist damit theoretisch zeitseitenkanal-angreifbar. In der Praxis ueber Netzwerklatenz schwer ausnutzbar, bei einem Secret mit Voll-DB-Zugriff (MCP) aber relevant.
- Fix: Vergleich ueber crypto.timingSafeEqual auf gleich langen Buffern durchfuehren (bei Laengenunterschied direkt ablehnen).

## [P3] Storage-Fehlerantworten von Supabase werden ungefiltert geloggt
- Ort: `src/lib/storage.ts:32` · PLAUSIBLE · funktionserhaltend · Aufwand S
- Szenario: Bei fehlgeschlagenem Signieren/Upload/Delete wird der komplette Supabase-Response-Body via console.error geloggt (:32 `await res.text()`, :86 `await res.text()`, :106 delete-Fehler). Diese Antworten enthalten interne Objekt-Pfade/Bucket-Details und potenziell Request-Kontext; die Logs sind in Vercel breiter einsehbar als die DB. Kein direkter Secret-Leak (Service-Key steht nur im Authorization-Header, nicht im Body), aber Informationspreisgabe ueber Storage-Struktur.
- Fix: Nur Statuscode und eine generische Meldung loggen; den Response-Body weglassen oder auf ein sicheres Feld begrenzen.

