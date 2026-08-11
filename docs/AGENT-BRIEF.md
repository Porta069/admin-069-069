# PORTAWERK Admin — Modul-Briefing (intern)

Du baust Module für das interne Admin-Dashboard von PORTAWERK (invertierte Jobbörse für Handwerker). Das Fundament (Auth, RBAC, Design-System, Shell, DataTable) existiert bereits — NICHT verändern, nur benutzen.

## Harte Regeln

1. **Keine neuen npm-Pakete installieren.** Vorhanden: next 16 (App Router), react 19, tailwind v4, shadcn/ui (`@/components/ui/*`), lucide-react, recharts, date-fns, postgres, sonner.
2. **Nur in deinen zugewiesenen Routen-Ordnern schreiben** (`src/app/(app)/<modul>/**`). Gemeinsame Dateien (`src/lib/*`, `src/components/*`, layouts) nie editieren. Wenn du eine Hilfskomponente brauchst, lege sie IN deinem Modulordner an (`_components/`-Unterordner).
3. **Jede Page beginnt mit `await requireEmployee("<modul>")`**, jede Server Action mit `await requirePermission("<modul>", "<action>")`. Frontend ist NIE Security-Layer.
4. **Jede Mutation** ruft danach `recordAudit({ actorId, action, entityType, entityId, metadata })` auf.
5. **Soft Delete**: nie `delete from` auf admin-Tabellen — `deleted_at = now()` setzen.
6. **UI-Sprache: Deutsch.** Keine rohen Fehlermeldungen an den User (try/catch in Actions, deutsche Meldung zurückgeben, Details nur `console.error`).
7. **Serverseitige Pagination/Filter/Sortierung** über URL-Params (Muster unten). Nie alle Datensätze laden. Sort-Keys nur über `safeSort`-Allowlist in SQL.
8. **Platform-Tabellen (public schema) sind READ-ONLY per SQL.** Mutationen an Platform-Daten nur über `src/lib/backend.ts` (Render-API). Admin-Schema (`admin.*`) darf gelesen und geschrieben werden.
9. TypeScript strikt — `npx tsc --noEmit` muss für deine Dateien sauber sein. Zitiere Spaltennamen mit Großbuchstaben in SQL immer in doppelten Anführungszeichen: `"firstName"`.

## Design-Sprache (Workbench)

- Ruhig, präzise, hochwertig. Warmes Papier-Weiß, Karten `bg-card` mit `rounded-lg border`, EIN Akzent (Orange, `text-primary`/`bg-primary`) sparsam.
- Überschriften nutzen automatisch die Display-Font (h1–h3). Zahlen/IDs: Klasse `tabular` oder `font-mono`.
- Seitengerüst: `<PageHeader title description actions>` oben, dann Inhalt. KPIs mit `<KpiCard>`. Status IMMER als `<StatusBadge map={...} value={...}>`. Prioritäten als `<PriorityBadge>`.
- Loading: `loading.tsx` mit `<Skeleton>`-Raster pro Modul. Empty: `<EmptyState>`. Fehlerzustände: verständliche deutsche Meldung mit Retry-Hinweis.
- Kleine Aktionen in `<Dialog>`/`<Sheet>` (Side Panel), keine ganzen Seitenwechsel.

## Kern-Imports

```ts
import { requireEmployee, requirePermission, getEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";                    // postgres.js Tagged Templates
import { recordAudit } from "@/lib/audit";
import * as backend from "@/lib/backend";          // Render-API (admin key server-only)
import { readTableParams, safeSort, firstParam, type SearchParams } from "@/lib/table-params";
import { formatDate, formatDateTime, formatRelative, formatEuroCents, formatNumber, initials } from "@/lib/format";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Timeline, type TimelineEvent } from "@/components/common/timeline";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { DataTable, type DataTableColumn, type DataTableRow, type BulkAction } from "@/components/data-table/data-table";
import { FilterSelect } from "@/components/data-table/filter-select";
import {
  CANDIDATE_STATUS, APPLICATION_STATUS, JOB_APPLICATION_STATUS, JOB_STATUS,
  REFERRAL_STATUS, JOB_OFFER_STATUS, CONTACT_REQUEST_STATUS, TASK_STATUS,
  PLACEMENT_STATUS, REWARD_STATUS, COMPANY_STATUS, EMPLOYEE_STATUS,
  PRIORITIES, PRIORITY_LABELS, ENTITY_LABELS, entityHref, statusDef,
} from "@/lib/definitions";
```

## Muster: Listen-Page (Server Component)

```tsx
// src/app/(app)/<modul>/page.tsx
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const employee = await requireEmployee("candidates");
  const params = await searchParams;
  const { page, pageSize, q, sort, dir } = readTableParams(params, { sort: "createdAt" });
  const status = firstParam(params.status);

  const orderBy = safeSort(sort, { name: `"lastName"`, createdAt: `"createdAt"` }, `"createdAt"`);
  const offset = (page - 1) * pageSize;
  const like = `%${q}%`;

  const rows = await sql`
    select a.*, cm.status as admin_status, cm.priority, e.name as assignee_name, e.avatar_color
    from public."Application" a
    left join admin.candidate_meta cm on cm.application_id = a.id
    left join admin.employee e on e.id = cm.assignee_id
    where a.status <> 'ERASED'
      ${q ? sql`and (a."firstName" || ' ' || a."lastName" ilike ${like} or a.email ilike ${like})` : sql``}
      ${status ? sql`and coalesce(cm.status,'NEU') = ${status}` : sql``}
    order by ${sql.unsafe(orderBy)} ${dir === "asc" ? sql`asc` : sql`desc`}
    limit ${pageSize} offset ${offset}`;
  const [{ count }] = await sql`select count(*)::int as count from ... (gleiche WHERE-Klausel)`;

  // Zellen serverseitig als ReactNode rendern:
  const tableRows: DataTableRow[] = rows.map((r) => ({
    id: r.id, href: `/kandidaten/${r.id}`,
    cells: {
      name: <span className="font-medium">{r.firstName} {r.lastName}</span>,
      status: <StatusBadge map={CANDIDATE_STATUS} value={r.admin_status ?? "NEU"} />,
      // ...
    },
  }));

  return (
    <>
      <PageHeader title="Kandidaten" description="…" />
      <DataTable tableId="kandidaten" columns={columns} rows={tableRows}
        total={count} page={page} pageSize={pageSize}
        toolbar={<FilterSelect param="status" placeholder="Alle Status" options={...} />}
        bulkActions={[{ label: "…", action: bulkServerAction }]} />
    </>
  );
}
```

`postgres.js`-Hinweise: Tagged Templates sind SQL-injection-sicher; dynamische Fragmente via bedingter `sql``-Fragmente wie oben; `sql.json(obj)` für jsonb; Ergebniszeilen sind camelCase NICHT automatisch — Spaltennamen kommen wie in der DB (`first_name` bzw. `"firstName"` exakt).

## Muster: Server Action

```ts
"use server";
export async function assignCandidate(applicationId: string, assigneeId: string | null) {
  try {
    const employee = await requirePermission("candidates", "assign");
    await sql`
      insert into admin.candidate_meta (application_id, assignee_id, updated_at)
      values (${applicationId}, ${assigneeId}, now())
      on conflict (application_id) do update set assignee_id = ${assigneeId}, updated_at = now()`;
    await recordAudit({ actorId: employee.id, action: "candidate.assigned", entityType: "candidate", entityId: applicationId, metadata: { assigneeId } });
    revalidatePath("/kandidaten");
    return { ok: true as const };
  } catch (e) {
    console.error(e);
    return { ok: false as const, message: "Zuweisung fehlgeschlagen." };
  }
}
```

## Datenmodell — Plattform (public, READ-ONLY per SQL)

- **Application** (= Kandidat/Handwerker): id, "firstName", "lastName", birthYear, email, phone, profession, "federalState", availability, verified, "verifiedAt", "searchIntent" (ACTIVE|PASSIVE), status (SUBMITTED|IN_REVIEW|MATCHED|ARCHIVED|ERASED), "consentAt", "createdAt", "updatedAt", "erasedAt". **ERASED immer ausfiltern.**
- **User**: id, email, "firstName", "lastName", phone, role (APPLICANT|EMPLOYER), status, "companyId", "companyName", "referredBy", "profileData" (jsonb), "lastLoginAt", "createdAt".
- **Company**: id, name, slogan, description, strasse, plz, ort, lat, lng, website, "kontaktName", "kontaktPosition", "kontaktTelefon", "kontaktEmail", benefits (array), montage, urlaubstage, logo, source (SELF|ADMIN|AI), "createdAt".
- **JobPosting**: id, "companyId", title, gewerk, description, tags, city, lat, lng, "salaryMin", "salaryMax", montage, urlaubstage, status (DRAFT|ACTIVE|PAUSED|ARCHIVED), source, bereiche, berufe, "erfahrungMin", "erfahrungMax", "ausbildungMin", "deutschMin", "fuehrerscheinMin", gewichte (Matching-Gewichte!), gebotenes, aufgaben, "createdAt".
- **JobApplication** (= Bewerbung): id, "jobPostingId", "userId", status (SENT|SEEN|INTERVIEW|REJECTED|ACCEPTED), "createdAt", "updatedAt".
- **JobOffer** (= Angebot vom Betrieb): id, "jobPostingId", "userId", message, "contactPerson", status (NEW|ACCEPTED|DECLINED), "declineReason", "createdAt".
- **ContactRequest**: id, "companyId", "userId", position, status (REQUESTED|APPROVED|DECLINED), "createdAt".
- **Document**: id, "applicationId", type (PHOTO|CV|QUALIFICATION), "originalName", "mimeType", "sizeBytes", "createdAt".
- **Partner**: id, name, slug, phone, email, status, "payoutIban", "payoutHolder", "lastLoginAt", "createdAt".
- **Referral**: id, "partnerId", "referredUserId", "candidateName", "candidateTrade", status (REGISTERED|IN_PLACEMENT|PLACED|PAID), "rewardCents", "placedAt", "paidAt", "createdAt".
- **ReferralClick**: id, slug, "ipHash", "createdAt".
- **AuditEvent** (Plattform-Audit): id, action, "entityType", "entityId", "actorId", metadata, "createdAt".

## Datenmodell — Admin (admin.*, Lesen + Schreiben ok)

- **admin.employee**: id (uuid), email, name, password_hash, role_id (STAFF|TEAMLEAD|ADMIN|SUPERADMIN), status (ACTIVE|DISABLED), team, avatar_color, last_login_at, created_at, deleted_at
- **admin.role**: id, name, description, permissions (jsonb `{modul: [aktionen]}`), is_system
- **admin.session**: token_hash, employee_id, ip, user_agent, created_at, expires_at, revoked_at
- **admin.login_event**: id, employee_id, email, success, ip, user_agent, created_at
- **admin.audit_log**: id, actor_id, action, entity_type, entity_id, metadata, created_at
- **admin.task**: id, title, description, assignee_id, creator_id, due_at, priority (DRINGEND|HOCH|NORMAL|NIEDRIG), status (OPEN|IN_PROGRESS|DONE|CANCELLED), entity_type, entity_id, completed_at, deleted_at
- **admin.note**: id, content, category, author_id, entity_type, entity_id, pinned, created_at, deleted_at
- **admin.appointment**: id, title, description, starts_at, ends_at, employee_id, entity_type, entity_id, location, status (PLANNED|DONE|CANCELLED), deleted_at
- **admin.tag** (id, name, color) + **admin.entity_tag** (tag_id, entity_type, entity_id)
- **admin.saved_view**: id, employee_id, module, name, config (jsonb)
- **admin.favorite**: employee_id, entity_type, entity_id
- **admin.candidate_meta**: application_id (pk), status (Pipeline: NEU|IN_BEARBEITUNG|GEPRUEFT|MATCHING|VORGESCHLAGEN|BEWERBUNG|INTERVIEW|ZUSAGE|VERMITTELT|ABGELEHNT|INAKTIV), assignee_id, priority, archived_at
- **admin.company_meta**: company_id (pk), status, assignee_id, priority, archived_at
- **admin.placement**: id, application_id, candidate_name, company_id, company_name, job_posting_id, job_title, referral_id, employee_id, status (PLACED|INVOICED|PAID|CANCELLED), placed_at, base_fee_cents (default 4900), commission_cents, notes, deleted_at
- **admin.template**: id, name, type (EMAIL|NACHRICHT|BEWERBUNGSANTWORT|TERMINBESTAETIGUNG|ANSCHREIBEN), subject, body (Variablen: {first_name} {last_name} {company} {job_title}), deleted_at
- **admin.notification**: id, employee_id, type, title, body, entity_type, entity_id, priority, read_at
- **admin.communication**: id, channel (EMAIL|TELEFON|WHATSAPP|SONSTIGE), direction (INBOUND|OUTBOUND), subject, body, entity_type, entity_id, employee_id, occurred_at, deleted_at
- **admin.automation**: id, name, trigger, conditions (jsonb), actions (jsonb), enabled, deleted_at
- **admin.setting**: key, value (jsonb). Keys: `pricing` {base_fee_cents:4900, max_commission_cents:250000, referral_reward_cents:10000}, `candidate_statuses`, `company_statuses`, `note_categories`
- **admin.dashboard_config**: employee_id, widgets (jsonb)

Entity-Typen für entity_type-Spalten: `candidate` (Application.id), `company`, `job`, `application` (JobApplication.id), `placement`, `referral`, `partner`, `employee`. Links via `entityHref(type, id)`.

## Render-Backend-API (`src/lib/backend.ts`)

- `listApplications(params)`, `getApplication(id)`, `eraseApplication(id)` — DSGVO-Löschung, nur mit Permission `candidates:delete`
- `listReferrals()`, `setReferralStatus(id, "REGISTERED"|"IN_PLACEMENT"|"PLACED"|"PAID")` — **Statuswechsel von Referrals MUSS über diese API laufen** (löst Prämienlogik im Backend aus)
- `adminListCompanies()`, `adminCreateCompany(payload)`
- `getPlatformStats()`, `getCatalog()` (Berufe/Gewerke-Katalog)

Backend kann kalt sein (Render Free Tier) — Fehler abfangen, deutsche Meldung („Backend wacht gerade auf, bitte kurz erneut versuchen") zeigen. Für reine Listen-Reads ist direktes SQL auf public-Tabellen schneller und erlaubt.

## Sonstiges

- Geld: IMMER Cents in DB, Anzeige via `formatEuroCents`. Preise aus `admin.setting` `pricing` lesen, NIE hardcoden.
- Datum: `formatDate`/`formatDateTime`/`formatRelative` (Europe/Berlin).
- `revalidatePath` nach Mutationen.
- Karten/Charts: recharts für Charts (Farben: var(--chart-1..5)).
