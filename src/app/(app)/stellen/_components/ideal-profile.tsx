import type { LucideIcon } from "lucide-react";
import {
  Award,
  Ban,
  Car,
  CalendarClock,
  Caravan,
  Euro,
  GraduationCap,
  Hammer,
  Heart,
  Languages,
  ListChecks,
  MapPin,
  Tag,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import {
  buildIdealProfile,
  WEIGHT_MAX,
  type JobCriteriaFields,
} from "../_lib/job-criteria";

const CRITERIA_ICONS: Record<string, LucideIcon> = {
  aufgaben: ListChecks,
  aufgabenMin: ListChecks,
  erfahrung: Award,
  beruf: Wrench,
  bezeichnung: Tag,
  gehalt: Euro,
  wuensche: Heart,
  fuehrerschein: Car,
  meister: GraduationCap,
  start: CalendarClock,
  gewerk: Hammer,
  abschluss: GraduationCap,
  fuehrung: UserRoundCheck,
  montage: Caravan,
  deutsch: Languages,
  entfernung: MapPin,
};

/**
 * „Optimales Kandidatenprofil" — legt offen, welches Registrierungsprofil für
 * diese Stelle den besten Score erzielt, sauber getrennt nach den zwei Stufen
 * der Engine: Ausschlusskriterien (Stufe 1) und Punktwertung (Stufe 2, 0–5).
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
  const gewichtet = rows.filter((r) => r.art === "gewichtet");
  const ausschluss = rows.filter((r) => r.art === "ausschluss");

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
          description="Ohne Kriterien kann die Stelle nicht sinnvoll gematcht werden. Lege Aufgabenbereiche, Erfahrung & Co. fest."
          action={emptyAction}
          className="border-0"
        />
      ) : (
        <>
          {gewichtet.length > 0 && (
            <div>
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Stufe 2 · Punktwertung (Gewicht 0–5)
              </p>
              <ul className="divide-y divide-border/60">
                {gewichtet.map((row) => {
                  const Icon = CRITERIA_ICONS[row.key] ?? ListChecks;
                  return (
                    <li
                      key={row.key}
                      className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[210px_minmax(0,1fr)_150px]"
                    >
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="size-4 shrink-0" />
                        {row.label}
                      </span>
                      <span className="text-sm font-medium">{row.value}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(100, Math.max(4, ((row.weight ?? 0) / WEIGHT_MAX) * 100))}%`,
                            }}
                          />
                        </span>
                        <span className="w-7 text-right text-xs text-muted-foreground tabular">
                          {row.weight}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {ausschluss.length > 0 && (
            <div className="border-t">
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Stufe 1 · Ausschlusskriterien — kein Prozentwert, Stelle wird
                sonst gar nicht angezeigt
              </p>
              <ul className="divide-y divide-border/60">
                {ausschluss.map((row) => {
                  const Icon = CRITERIA_ICONS[row.key] ?? Ban;
                  return (
                    <li
                      key={row.key}
                      className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-5 py-2.5 sm:grid-cols-[210px_minmax(0,1fr)_150px]"
                    >
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="size-4 shrink-0" />
                        {row.label}
                      </span>
                      <span className="text-sm font-medium">{row.value}</span>
                      <span className="text-right text-xs font-medium text-destructive/80">
                        Ausschluss
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
            Score = 100 × (1 − Σ(Gewicht × (1 − Erfüllung)) / Σ Gewicht) —
            nicht beantwortete Kriterien zählen weder im Zähler noch im Nenner.
          </p>
        </>
      )}
    </section>
  );
}
