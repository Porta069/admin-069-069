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

## Tools (14)

| Tool | Zweck |
|---|---|
| `dashboard_uebersicht` | KPIs: Kandidaten, Unternehmen, Stellen, Aufgaben, Vermittlungen, Finanzen |
| `kandidaten_suchen` | Suche nach Name/E-Mail/Telefon/Beruf, Status-Filter |
| `kandidat_details` | Stammdaten + komplettes Matching-Profil + Notizen + Aufgaben + Anrufe |
| `unternehmen_suchen` / `unternehmen_details` | Firmen inkl. Stellen & Notizen |
| `stellen_suchen` | Stellenanzeigen mit Unternehmen |
| `matching_fuer_kandidat` / `matching_fuer_stelle` | Echte Matching-Engine mit Scores |
| `aufgaben_liste` / `aufgabe_erstellen` | Aufgaben lesen/anlegen (markiert `[Claude MCP]`) |
| `notiz_erstellen` | Notiz an Kandidat/Unternehmen (markiert `[Claude MCP]`) |
| `finanzen_uebersicht` | Rechnungen, Auszahlungen, Summen |
| `mitarbeiter_liste` | Team mit Rolle/Arbeitslast |
| `sql_abfrage` | Beliebige **nur-lesende** SELECT-Abfrage (max. 200 Zeilen) |

## Sicherheitsmodell

- Schreibzugriff bewusst minimal: nur Aufgaben + Notizen (beide mit
  `[Claude MCP]`-Präfix gekennzeichnet, `author_id`/`creator_id` = null).
- `sql_abfrage` erzwingt Nur-Lesen: einzelnes Statement, muss mit
  SELECT/WITH beginnen, kein Semikolon, DML/DDL-Schlüsselwörter geblockt,
  Wrapping mit `limit 200`.
- Middleware (`src/proxy.ts`) nimmt `api/mcp` vom Login-Redirect aus; die
  Auth passiert in der Route selbst (`MCP_SECRET`).

## Technik

- `mcp-handler` (Vercel) + `@modelcontextprotocol/server`, zod v4.
- Datei: `src/app/api/mcp/route.ts` (`maxDuration 120s`).
- Matching nutzt dieselbe Engine wie das Dashboard (`src/lib/matching/rank`).
