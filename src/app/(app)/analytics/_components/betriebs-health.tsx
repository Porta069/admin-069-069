import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { EmptyState } from "@/components/common/empty-state";
import { Building2, Repeat } from "lucide-react";
import { FollowupButton } from "./followup-button";

const LIST_LIMIT = 50;

interface CompanyHealth {
  id: string;
  name: string;
  active_jobs: number;
  apps_30d: number;
  last_activity: Date | null;
  had_placement: boolean;
}

type Kategorie = "Aktiv" | "Ruhend" | "Churn-Risiko";

function kategorie(c: CompanyHealth): Kategorie {
  if (c.active_jobs > 0 || c.apps_30d > 0) return "Aktiv";
  const last = c.last_activity ? new Date(c.last_activity).getTime() : 0;
  const days = last ? (Date.now() - last) / 86_400_000 : Infinity;
  if (days <= 90) return "Ruhend";
  return "Churn-Risiko";
}

/**
 * Abschnitt „Unternehmen (Health & Wiederholungsgeschäft)" für /analytics.
 * Eigenständige Server-Komponente — wird vom Koordinator in page.tsx eingebaut.
 */
export async function BetriebsHealth() {
  const employee = await requireEmployee("analytics");
  const canFollowup = can(employee, "companies", "edit");

  const rows = await sql<CompanyHealth[]>`
    select c.id, c.name,
      (select count(*)::int from public."JobPosting" j
       where j."companyId" = c.id and j.status = 'ACTIVE') as active_jobs,
      (select count(*)::int from public."JobApplication" ja
       join public."JobPosting" j on j.id = ja."jobPostingId"
       where j."companyId" = c.id and ja."createdAt" > now() - interval '30 days') as apps_30d,
      greatest(
        c."createdAt",
        (select max(j."createdAt") from public."JobPosting" j where j."companyId" = c.id),
        (select max(ja."createdAt") from public."JobApplication" ja
         join public."JobPosting" j on j.id = ja."jobPostingId"
         where j."companyId" = c.id)
      ) as last_activity,
      exists (
        select 1 from admin.placement p
        where p.company_id = c.id and p.deleted_at is null and p.status <> 'CANCELLED'
      ) as had_placement
    from public."Company" c`;

  const counts: Record<Kategorie, number> = {
    Aktiv: 0,
    Ruhend: 0,
    "Churn-Risiko": 0,
  };
  const churn: CompanyHealth[] = [];
  for (const c of rows) {
    const k = kategorie(c);
    counts[k] += 1;
    if (k === "Churn-Risiko") churn.push(c);
  }
  churn.sort((a, b) => {
    const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
    const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
    return ta - tb;
  });

  // Wiederholungsgeschäft: erfolgreich vermittelt, aber aktuell keine offene Stelle.
  const wiederholung = rows
    .filter((c) => c.had_placement && c.active_jobs === 0)
    .sort((a, b) => {
      const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
      return tb - ta;
    });

  const tiles: { label: Kategorie; tone: string }[] = [
    { label: "Aktiv", tone: "bg-success-soft text-success" },
    { label: "Ruhend", tone: "bg-info-soft text-info" },
    { label: "Churn-Risiko", tone: "bg-warning-soft text-warning" },
  ];

  return (
    <section className="mb-5 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Building2 className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold">
          Unternehmen · Health &amp; Wiederholungsgeschäft
        </h2>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Noch keine Unternehmen"
          description="Sobald Unternehmen angelegt sind, erscheint hier ihr Health-Status."
          className="border-0 py-10"
        />
      ) : (
        <div className="space-y-5 p-4">
          {/* Kategorien */}
          <div className="grid gap-3 sm:grid-cols-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg border bg-muted/30 p-4">
                <span
                  className={
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " + t.tone
                  }
                >
                  {t.label}
                </span>
                <p className="mt-2 font-display text-2xl font-semibold tabular">
                  {counts[t.label]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.label === "Aktiv"
                    ? "offene Stelle oder Bewerbung (30 T.)"
                    : t.label === "Ruhend"
                      ? "Aktivität in den letzten 90 Tagen"
                      : "über 90 Tage keine Aktivität"}
                </p>
              </div>
            ))}
          </div>

          {/* Churn-Risiko */}
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Churn-Risiko · lange keine Aktivität
            </h3>
            {churn.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Kein Unternehmen im Churn-Risiko.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Unternehmen</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Vermittelt?
                      </th>
                      <th className="px-4 py-2.5 font-medium">Letzte Aktivität</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churn.slice(0, LIST_LIMIT).map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/unternehmen/${c.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.had_placement ? "Ja" : "Nein"}
                        </td>
                        <td className="px-4 py-2.5 tabular text-muted-foreground">
                          {c.last_activity ? formatRelative(c.last_activity) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Wiederholungsgeschäft */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Repeat className="size-3.5" />
              Wiederholungsgeschäft · vermittelt, aktuell keine offene Stelle
            </h3>
            {wiederholung.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Keine Follow-up-Kandidaten. Unternehmen mit erfolgreicher Vermittlung
                und offener Stelle sind bereits aktiv.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {wiederholung.slice(0, LIST_LIMIT).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/unternehmen/${c.id}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Letzte Aktivität:{" "}
                        {c.last_activity ? formatRelative(c.last_activity) : "—"}
                      </p>
                    </div>
                    {canFollowup && (
                      <FollowupButton companyId={c.id} companyName={c.name} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
