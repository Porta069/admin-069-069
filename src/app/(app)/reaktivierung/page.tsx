import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatRelative } from "@/lib/format";
import { extractProfile, profilIstLeer } from "@/lib/matching/profile";
import { CANDIDATE_STATUS } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { RotateCcw } from "lucide-react";
import { ReaktivierungActions } from "./_components/reaktivierung-actions";

const SCAN_LIMIT = 3000;
const LIST_LIMIT = 100;

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  profession: string | null;
  federalState: string | null;
  updatedAt: Date;
  pipeline_status: string | null;
  verfuegbar_bestaetigt_am: Date | null;
  best_score: number | null;
  profileData: unknown;
}

function scoreClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-muted-foreground";
}

export default async function ReaktivierungPage() {
  await requireEmployee("candidates");

  const rows = await sql<Row[]>`
    select a.id, a."firstName", a."lastName", a.profession, a."federalState",
           a."updatedAt", u."profileData" as "profileData",
           cm.status as pipeline_status,
           cm.verfuegbar_bestaetigt_am,
           greatest(
             coalesce((select max(ms.match_score) from admin.match_suggestion ms
                       where ms.application_id = a.id), 0),
             coalesce((select max(p.match_score) from admin.proposal p
                       where p.application_id = a.id and p.deleted_at is null), 0)
           ) as best_score
    from admin.candidate a
    left join public."User" u on lower(u.email) = lower(a.email)
    left join admin.candidate_meta cm on cm.application_id = a.id
    where a.status <> 'ERASED'
      and a."updatedAt" < now() - interval '30 days'
      and coalesce(cm.status, 'NEU') <> 'VERMITTELT'
      and not exists (
        select 1 from admin.note n
        where n.entity_type = 'candidate' and n.entity_id = a.id
          and n.deleted_at is null and n.created_at > now() - interval '30 days')
      and not exists (
        select 1 from admin.task t
        where t.entity_type = 'candidate' and t.entity_id = a.id
          and t.deleted_at is null
          and (t.created_at > now() - interval '30 days'
               or t.updated_at > now() - interval '30 days'))
      and not exists (
        select 1 from admin.communication co
        where co.entity_type = 'candidate' and co.entity_id = a.id
          and co.deleted_at is null and co.occurred_at > now() - interval '30 days')
    order by a."updatedAt" asc
    limit ${SCAN_LIMIT}`;

  // Nur Kandidaten mit verwertbarem (nicht leerem) Matching-Profil.
  const verwertbar = rows.filter((r) => {
    if (r.profileData == null) return false;
    return !profilIstLeer(extractProfile(r.profileData).profil);
  });

  // Bester verfügbarer Match-Score (aus Radar/Vorschlägen), sonst ganz nach hinten.
  verwertbar.sort((a, b) => (b.best_score ?? 0) - (a.best_score ?? 0));

  const mitScore = verwertbar.filter((r) => (r.best_score ?? 0) > 0).length;
  const bestaetigt = verwertbar.filter((r) => r.verfuegbar_bestaetigt_am).length;
  const list = verwertbar.slice(0, LIST_LIMIT);

  return (
    <>
      <PageHeader
        title="Reaktivierung"
        description="Grundsätzlich vermittelbare Kandidaten, die seit über 30 Tagen keine Aktivität hatten — sortiert nach bestem verfügbaren Match-Score."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Reaktivierbar"
          value={verwertbar.length}
          hint="inaktiv, aber mit Profil"
          accent
        />
        <KpiCard
          label="Mit Match-Score"
          value={mitScore}
          hint="bereits ein Top-Match erkannt"
        />
        <KpiCard
          label="Verfügbarkeit bestätigt"
          value={bestaetigt}
          hint="kürzlich als verfügbar markiert"
        />
      </div>

      <section className="overflow-x-auto rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-display text-sm font-semibold">
            Kandidaten zur Reaktivierung
          </h2>
          <p className="text-xs text-muted-foreground">
            Kein Kontakt seit &gt; 30 Tagen (keine Notiz, Aufgabe oder Kommunikation)
            und verwertbares Profil.
          </p>
        </div>
        {list.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="Keine Kandidaten zur Reaktivierung"
            description="Aktuell hat jeder vermittelbare Kandidat eine kürzliche Aktivität — nichts zu tun."
            className="border-0 py-12"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Beruf</th>
                <th className="px-4 py-2.5 font-medium">Pipeline</th>
                <th className="px-4 py-2.5 text-right font-medium">Bester Score</th>
                <th className="px-4 py-2.5 font-medium">Letzte Aktivität</th>
                <th className="px-4 py-2.5 font-medium">Zuletzt verfügbar</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/kandidaten/${r.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                    {r.federalState && (
                      <span className="block text-xs text-muted-foreground">
                        {r.federalState}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{r.profession ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      map={CANDIDATE_STATUS}
                      value={r.pipeline_status ?? "NEU"}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.best_score && r.best_score > 0 ? (
                      <span
                        className={
                          "font-display text-base font-semibold tabular " +
                          scoreClass(r.best_score)
                        }
                      >
                        {r.best_score} %
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular text-muted-foreground">
                    {formatRelative(r.updatedAt)}
                  </td>
                  <td className="px-4 py-2.5 tabular">
                    {r.verfuegbar_bestaetigt_am ? (
                      formatDate(r.verfuegbar_bestaetigt_am)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <ReaktivierungActions applicationId={r.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {verwertbar.length > LIST_LIMIT && (
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Zeigt die {LIST_LIMIT} Kandidaten mit dem besten Score · insgesamt{" "}
            {verwertbar.length} reaktivierbar.
          </p>
        )}
      </section>
    </>
  );
}
