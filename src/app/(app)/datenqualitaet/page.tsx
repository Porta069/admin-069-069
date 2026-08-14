import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { extractProfile, profilIstLeer } from "@/lib/matching/profile";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  CircleUserRound,
  Building2,
  ClipboardList,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { MergeDialog, type MergeCandidate } from "./_components/merge-dialog";
import { mergeCandidates, mergeCompanies } from "./actions";

const SCAN_LIMIT = 5000;
const LIST_LIMIT = 50;

interface AppRow {
  id: string;
  firstName: string;
  lastName: string;
  profession: string | null;
  federalState: string | null;
  email: string;
  birthYear: number | null;
  createdAt: Date;
  profileData: unknown;
}

/** Kartenrahmen für einen Abschnitt. */
function Section({
  icon: Icon,
  title,
  description,
  count,
  children,
}: {
  icon: typeof CircleUserRound;
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span
          className={
            "ml-auto rounded-full px-2.5 py-0.5 text-sm font-semibold tabular " +
            (count > 0
              ? "bg-warning-soft text-warning"
              : "bg-success-soft text-success")
          }
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function DatenqualitaetPage() {
  const employee = await requireEmployee("candidates");
  const canMerge = can(employee, "candidates", "edit");

  // ── Daten laden ────────────────────────────────────────────────────────
  const [apps, jobsRaw, companyDupsRaw] = await Promise.all([
    sql<AppRow[]>`
      select a.id, a."firstName", a."lastName", a.profession, a."federalState",
             a.email, a."birthYear", a."createdAt", u."profileData" as "profileData"
      from admin.candidate a
      left join public."User" u on lower(u.email) = lower(a.email)
      where a.status <> 'ERASED'
      order by a."createdAt" desc
      limit ${SCAN_LIMIT}`,
    sql`
      select j.id, j.title, c.name as company_name
      from public."JobPosting" j
      left join public."Company" c on c.id = j."companyId"
      where j.status = 'ACTIVE'
        and coalesce(array_length(j.bereiche, 1), 0) = 0
        and coalesce(array_length(j.berufe, 1), 0) = 0
        and coalesce(array_length(j.aufgaben, 1), 0) = 0
        and j."erfahrungMin" is null and j."erfahrungMax" is null
        and j."ausbildungMin" is null and j."montageMin" is null
        and j."deutschMin" is null and j."fuehrerscheinMin" is null
        and coalesce(array_length(j.gebotenes, 1), 0) = 0
        and j."startBis" is null and coalesce(j."aufgabenMin", 0) = 0
      order by j."createdAt" desc
      limit 200`,
    sql`
      select lower(trim(name)) as key,
             array_agg(id order by "createdAt") as ids,
             array_agg(name order by "createdAt") as names,
             array_agg(coalesce(ort, '') order by "createdAt") as orte,
             count(*)::int as c
      from public."Company"
      where name is not null and trim(name) <> ''
      group by lower(trim(name))
      having count(*) > 1
      order by c desc
      limit 100`,
  ]);

  // ── Kandidaten ohne Matching-Profil (JS: extractProfile + profilIstLeer) ──
  const ohneProfil: AppRow[] = apps.filter((a) => {
    if (a.profileData == null) return true;
    return profilIstLeer(extractProfile(a.profileData).profil);
  });

  // ── Dublette-Kandidaten: gleiche E-Mail ODER gleicher Name (+Geburtsjahr) ─
  const byEmail = new Map<string, AppRow[]>();
  const byName = new Map<string, AppRow[]>();
  for (const a of apps) {
    const email = a.email?.trim().toLowerCase();
    if (email) {
      const arr = byEmail.get(email) ?? [];
      arr.push(a);
      byEmail.set(email, arr);
    }
    const name = `${a.firstName ?? ""}|${a.lastName ?? ""}`.trim().toLowerCase();
    const nameKey = `${name}|${a.birthYear ?? ""}`;
    if (name.replace("|", "")) {
      const arr = byName.get(nameKey) ?? [];
      arr.push(a);
      byName.set(nameKey, arr);
    }
  }
  type DupGroup = { key: string; grund: string; rows: AppRow[] };
  const candidateGroups: DupGroup[] = [];
  const seen = new Set<string>(); // verhindert Doppel-Anzeige gleicher Gruppen
  for (const [key, rows] of byEmail) {
    if (rows.length < 2) continue;
    const sig = rows.map((r) => r.id).sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    candidateGroups.push({ key, grund: "Gleiche E-Mail", rows });
  }
  for (const [key, rows] of byName) {
    if (rows.length < 2) continue;
    const sig = rows.map((r) => r.id).sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    candidateGroups.push({ key, grund: "Gleicher Name + Geburtsjahr", rows });
  }

  const companyGroups = companyDupsRaw.map((g) => ({
    ids: g.ids as string[],
    names: g.names as string[],
    orte: g.orte as string[],
    count: g.c as number,
  }));

  return (
    <>
      <PageHeader
        title="Datenqualität"
        description="Lücken und Dubletten, die Matching und Vermittlung ausbremsen — mit direkten Aktionen zur Bereinigung."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ohne Matching-Profil"
          value={ohneProfil.length}
          hint="tauchen in keinem Match auf"
        />
        <KpiCard
          label="Jobs ohne Kriterien"
          value={jobsRaw.length}
          hint="matchen für jeden — nutzlos"
        />
        <KpiCard
          label="Dublette-Kandidaten"
          value={candidateGroups.length}
          hint="mögliche Gruppen"
        />
        <KpiCard
          label="Dublette-Unternehmen"
          value={companyGroups.length}
          hint="gleicher Name"
        />
      </div>

      <div className="space-y-5">
        {/* Kandidaten ohne Matching-Profil */}
        <Section
          icon={CircleUserRound}
          title="Kandidaten ohne Matching-Profil"
          description={`Kein hinterlegtes oder leeres Fragebogen-Profil — analysiert werden die neuesten ${SCAN_LIMIT.toLocaleString("de-DE")} Kandidaten.`}
          count={ohneProfil.length}
        >
          {ohneProfil.length === 0 ? (
            <EmptyState
              title="Alle Kandidaten haben ein Profil"
              description="Jeder analysierte Kandidat besitzt ein verwertbares Matching-Profil."
              className="border-0 py-10"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Beruf</th>
                    <th className="px-4 py-2.5 font-medium">Bundesland</th>
                    <th className="px-4 py-2.5 font-medium">Registriert</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {ohneProfil.slice(0, LIST_LIMIT).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">
                        {a.firstName} {a.lastName}
                      </td>
                      <td className="px-4 py-2.5">{a.profession ?? "—"}</td>
                      <td className="px-4 py-2.5">{a.federalState ?? "—"}</td>
                      <td className="px-4 py-2.5 tabular">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button asChild variant="outline" size="sm" className="bg-card">
                          <Link href={`/kandidaten/${a.id}`}>Öffnen</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ohneProfil.length > LIST_LIMIT && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  … und {ohneProfil.length - LIST_LIMIT} weitere.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Jobs ohne Kriterien */}
        <Section
          icon={ClipboardList}
          title="Jobs ohne Kriterien"
          description="Aktive Stellen ohne gewichtsrelevante Kriterien — sie matchen zu 100 % für jeden."
          count={jobsRaw.length}
        >
          {jobsRaw.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="Alle aktiven Stellen haben Kriterien"
              description="Jede aktive Stelle enthält mindestens ein bewertbares Matching-Kriterium."
              className="border-0 py-10"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Stelle</th>
                    <th className="px-4 py-2.5 font-medium">Unternehmen</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {jobsRaw.map((j) => (
                    <tr key={j.id as string} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{j.title as string}</td>
                      <td className="px-4 py-2.5">
                        {(j.company_name as string) ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button asChild variant="outline" size="sm" className="bg-card">
                          <Link href={`/stellen/${j.id as string}`}>
                            Kriterien pflegen
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Mögliche Dublette-Kandidaten */}
        <Section
          icon={Copy}
          title="Mögliche Dublette-Kandidaten"
          description="Gleiche E-Mail oder gleicher Name (+ Geburtsjahr). Hinweis: die Plattform kennt keine PLZ am Kandidaten."
          count={candidateGroups.length}
        >
          {candidateGroups.length === 0 ? (
            <EmptyState
              title="Keine Dubletten gefunden"
              description="Keine Kandidaten mit gleicher E-Mail oder gleichem Namen entdeckt."
              className="border-0 py-10"
            />
          ) : (
            <ul className="divide-y">
              {candidateGroups.slice(0, LIST_LIMIT).map((g) => {
                const entities: MergeCandidate[] = g.rows.map((r) => ({
                  id: r.id,
                  label: `${r.firstName} ${r.lastName}`,
                  sublabel: [r.email, r.profession, formatDate(r.createdAt)]
                    .filter(Boolean)
                    .join(" · "),
                }));
                return (
                  <li key={g.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {g.grund} · {g.rows.length} Datensätze
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {g.rows.map((r) => (
                          <Link
                            key={r.id}
                            href={`/kandidaten/${r.id}`}
                            className="text-sm font-medium hover:text-primary hover:underline"
                          >
                            {r.firstName} {r.lastName}
                          </Link>
                        ))}
                      </div>
                    </div>
                    {canMerge && (
                      <MergeDialog
                        entities={entities}
                        action={mergeCandidates}
                        entityLabel="Kandidat"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Mögliche Dublette-Unternehmen */}
        <Section
          icon={Building2}
          title="Mögliche Dublette-Unternehmen"
          description="Unternehmen mit exakt gleichem Namen."
          count={companyGroups.length}
        >
          {companyGroups.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Keine doppelten Unternehmen"
              description="Kein Firmenname kommt mehrfach vor."
              className="border-0 py-10"
            />
          ) : (
            <ul className="divide-y">
              {companyGroups.slice(0, LIST_LIMIT).map((g) => {
                const entities: MergeCandidate[] = g.ids.map((id, i) => ({
                  id,
                  label: g.names[i] ?? "—",
                  sublabel: g.orte[i] || undefined,
                }));
                return (
                  <li
                    key={g.ids.join(",")}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {g.count} Datensätze mit gleichem Namen
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {g.ids.map((id, i) => (
                          <Link
                            key={id}
                            href={`/unternehmen/${id}`}
                            className="text-sm font-medium hover:text-primary hover:underline"
                          >
                            {g.names[i]}
                            {g.orte[i] ? (
                              <span className="text-muted-foreground"> · {g.orte[i]}</span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                    {canMerge && (
                      <MergeDialog
                        entities={entities}
                        action={mergeCompanies}
                        entityLabel="Unternehmen"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
