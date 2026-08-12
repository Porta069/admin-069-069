import type { LucideIcon } from "lucide-react";
import {
  Award,
  Car,
  Caravan,
  GraduationCap,
  Hammer,
  Languages,
  ListChecks,
  MapPin,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import {
  buildIdealProfile,
  type JobCriteriaFields,
} from "../_lib/job-criteria";

const CRITERIA_ICONS: Record<string, LucideIcon> = {
  beruf: Wrench,
  bereich: Hammer,
  aufgaben: ListChecks,
  erfahrung: Award,
  ausbildung: GraduationCap,
  deutsch: Languages,
  fuehrerschein: Car,
  montage: Caravan,
  entfernung: MapPin,
};

/**
 * „Optimales Kandidatenprofil" — legt offen, welches Registrierungsprofil
 * für diese Stelle den besten Matching-Score erzielt. Wird auf stellen/[id]
 * und im Matching-Center wiederverwendet.
 */
export function IdealProfile({
  job,
  emptyAction,
  className,
}: {
  job: JobCriteriaFields;
  /** CTA für den EmptyState, z. B. „Kriterien bearbeiten". */
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  const rows = buildIdealProfile(job);
  // Balken relativ zum größten Gewicht des Jobs — funktioniert für
  // 1–5-Skalen genauso wie für 0–100.
  const maxWeight = Math.max(
    1,
    ...rows.map((r) => (r.weight != null ? r.weight : 0)),
  );

  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <div className="border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <UserRoundCheck className="size-4 text-primary" />
          Optimales Kandidatenprofil
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          So sieht das ideale Registrierungsprofil für diese Stelle aus —
          Kandidaten mit diesen Angaben landen oben im Feed.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={UserRoundCheck}
          title="Keine Matching-Kriterien gepflegt"
          description="Ohne Kriterien kann die Stelle nicht sinnvoll gematcht werden. Lege Beruf, Erfahrung & Co. fest."
          action={emptyAction}
          className="border-0"
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => {
            const Icon = CRITERIA_ICONS[row.key] ?? ListChecks;
            return (
              <li
                key={row.key}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[200px_minmax(0,1fr)_150px]"
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 shrink-0" />
                  {row.label}
                </span>
                <span className="text-sm font-medium">{row.value}</span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    {row.weight != null && (
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.max(4, (row.weight / maxWeight) * 100))}%`,
                        }}
                      />
                    )}
                  </span>
                  <span className="w-7 text-right text-xs text-muted-foreground tabular">
                    {row.weight != null ? row.weight : "—"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
          Balken = Gewicht des Kriteriums im Matching (sortiert absteigend,
          {" „—“ "}= kein Gewicht hinterlegt).
        </p>
      )}
    </section>
  );
}
