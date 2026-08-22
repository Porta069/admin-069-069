# MCP-Server des Admin-Dashboards

Remote-MCP-Server (Streamable HTTP), mit dem Claude (claude.ai, Claude Desktop,
Claude Code) direkt auf das Admin-Dashboard zugreift. Läuft in der bestehenden
Next.js-App — kein separater Dienst.

## Endpunkt & Auth

```
POST https://admin-069-069.vercel.app/api/mcp
```

Zugriff nur mit Secret-Token (`MCP_SECRET`, Vercel-Env + `.env.local`):

- Header: `Authorization: Bearer <MCP_SECRET>` — oder
- Query:  `?key=<MCP_SECRET>` (für Connectoren ohne Header-Support)

Ohne gesetztes `MCP_SECRET` ist der Endpunkt hart deaktiviert (immer 401).
**Der Token gewährt vollen Admin-Zugriff — niemals committen oder teilen.**
Rotation: neuen Wert erzeugen (`openssl rand -hex 32`), in Vercel-Env
`MCP_SECRET` ersetzen, neu deployen.

## In claude.ai einbinden

Einstellungen → Connectoren → **Eigenen Connector hinzufügen** → URL:

```
https://admin-069-069.vercel.app/api/mcp?key=<MCP_SECRET>
```

## In Claude Code einbinden

```sh
claude mcp add portawerk-admin --transport http \
  https://admin-069-069.vercel.app/api/mcp \
  --header "Authorization: Bearer <MCP_SECRET>"
```

## Tools (19) — VOLLER Zugriff

**Lesen & Analyse**

| Tool | Zweck |
|---|---|
| `dashboard_uebersicht` | KPIs: Kandidaten, Unternehmen, Stellen, Aufgaben, Vermittlungen, Finanzen |
| `kandidaten_suchen` | Suche nach Name/E-Mail/Telefon/Beruf, Status-Filter |
| `kandidat_details` | Stammdaten + komplettes Matching-Profil + Notizen + Aufgaben + Anrufe |
| `unternehmen_suchen` / `unternehmen_details` | Firmen inkl. Stellen & Notizen |
| `stellen_suchen` | Stellenanzeigen mit Unternehmen |
| `matching_fuer_kandidat` / `matching_fuer_stelle` | Echte Matching-Engine mit Scores |
| `aufgaben_liste` | Aufgaben lesen |
| `finanzen_uebersicht` | Rechnungen, Auszahlungen, Summen |
| `mitarbeiter_liste` | Team mit Rolle/Arbeitslast |
| `datenbank_schema` | Alle Tabellen & Spalten in `admin`/`public` |
| `sql_abfrage` | Beliebige **nur-lesende** SELECT-Abfrage (max. 200 Zeilen) |

**Schreiben & Aktionen (voller Zugriff)**

| Tool | Zweck |
|---|---|
| `aufgabe_erstellen` | Aufgabe anlegen |
| `notiz_erstellen` | Notiz an Kandidat/Unternehmen |
| `sql_schreiben` | **Beliebiges INSERT/UPDATE/DELETE** (auch massenhaft) — einzelnes Statement; DROP/TRUNCATE/ALTER gesperrt |
| `email_senden` | Branded E-Mail (Porta-Jobs-Design) über Outbox/Brevo versenden |
| `outbox_verarbeiten` | Ausstehende E-Mails zustellen |
| `sync_ausfuehren` | Daten-Sync (neue Registrierungen, fällige Aufgaben, Prämien, Automationen) |

## Sicherheitsmodell

- **Voller Datensatz-Zugriff** (`sql_schreiben`: INSERT/UPDATE/DELETE, auch
  massenhaft) — der einzige Zugangsschutz ist der geheime `MCP_SECRET`-Token.
  Entsprechend geheim halten und bei Verdacht rotieren.
- **Struktur-Schutz:** DROP/TRUNCATE/ALTER/GRANT/CREATE sind gesperrt — Claude
  kann Daten beliebig ändern/löschen, aber die Datenbank nicht zerstören
  (kein irreversibler Totalverlust).
- Ein Statement pro Aufruf (kein Semikolon); `sql_schreiben` verlangt
  INSERT/UPDATE/DELETE, `sql_abfrage` nur SELECT/WITH (max. 200 Zeilen).
- Middleware (`src/proxy.ts`) nimmt `api/mcp` vom Login-Redirect aus; die
  Auth passiert in der Route selbst (`MCP_SECRET`).

## Technik

- `mcp-handler` (Vercel) + `@modelcontextprotocol/server`, zod v4.
- Datei: `src/app/api/mcp/route.ts` (`maxDuration 120s`).
- Matching nutzt dieselbe Engine wie das Dashboard (`src/lib/matching/rank`).
