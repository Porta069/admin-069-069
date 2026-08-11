# PORTAWERK Admin

Internes CRM-, Recruiting- und Betriebssystem für PORTAWERK — die invertierte Jobbörse für Handwerker.

## Architektur

```
Admin Frontend (Next.js App Router, React Server Components)
        ↓
Session-Auth (httpOnly-Cookie, scrypt) + RBAC (admin.role.permissions)
        ↓
Server Layer (Server Components / Server Actions / Route Handlers)
        ↓                                    ↓
Render-Backend-API                    Supabase Postgres
(x-admin-api-key, server-only)        (public = Plattform read-only,
                                       admin.* = CRM-Schema)
```

- **Kein** direkter DB-Zugriff aus dem Browser. Jede Anfrage wird serverseitig authentifiziert und autorisiert (`requireEmployee` / `requirePermission`).
- Plattform-Daten (`public.*`) werden per SQL **nur gelesen**; Mutationen laufen über die sichere Render-API (`src/lib/backend.ts`).
- Das CRM-Schema `admin.*` (Mitarbeiter, Rollen, Sessions, Aufgaben, Notizen, Termine, Vermittlungen, Audit, …) gehört dem Admin-System.
- Jede relevante Mutation erzeugt einen Eintrag in `admin.audit_log`. Löschen ist Soft Delete (`deleted_at`).

## Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

### Env-Variablen

| Variable | Zweck |
| --- | --- |
| `DATABASE_URL` | Supabase Pooler (Transaction Mode, Port 6543) |
| `BACKEND_URL` | Render-Backend, z. B. `https://…/api/v1` |
| `ADMIN_API_KEY` | Admin-Key des Plattform-Backends (server-only) |
| `SESSION_SECRET` | Reserve für Token-Signierung |

## Deployment

Vercel-Projekt `admin-069-069` — Push auf `main` deployt automatisch. Env-Vars sind im Vercel-Projekt hinterlegt.

## Struktur

- `src/lib/` — Auth, RBAC, DB, Backend-Client, Audit, Formatierung
- `src/components/` — Design-System (shadcn/ui), DataTable, Shell, gemeinsame Bausteine
- `src/app/(app)/` — alle Module (Kandidaten, Unternehmen, Stellen, Bewerbungen, Matching, Vermittlungen, Aufgaben, Kalender, Kommunikation, Notizen, Dokumente, Karte, Analytics, Automatisierungen, Vorlagen, Benachrichtigungen, Affiliate, Prämien, Mitarbeiter, Rollen, Audit, Einstellungen)
- `docs/AGENT-BRIEF.md` — Modul-Konventionen und Datenmodell

## Bewusst vorbereitet, noch nicht final

Matching-Engine (Score/Kriterien/Override), Automation-Engine (Trigger→Conditions→Actions), E-Mail-/WhatsApp-Versand, Rechnungen/Finanzmodul. Die UI, das Datenmodell und die Berechtigungen sind dafür ausgelegt.
