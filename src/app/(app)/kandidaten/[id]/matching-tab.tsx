import Link from "next/link";
import type { RankErgebnis } from "@/lib/matching/rank";
import { labelFuer } from "@/lib/matching/catalog";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Building2,
  ChevronDown,
  EyeOff,
  MapPin,
  Sparkles,
  UserSquare2,
} from "lucide-react";

/**
 * Job-Matching für einen Kandidaten — exakt die Engine-Logik (Stufe 1
 * Ausschluss, Stufe 2 gewichtete Formel) aus src/lib/matching.
 */
export function MatchingTab({ ergebnis }: { ergebnis: RankErgebnis | null }) {
  if (!ergebnis) {
    return (
      <EmptyState
        icon={UserSquare2}
        title="Kein Matching-Profil vorhanden"
        description="Zu dieser E-Mail existiert kein Nutzerkonto auf der Plattform — der Registrierungsfragebogen kann daher nicht zugeordnet werden."
      />
    );
  }

  if (ergebnis.profilLeer) {
    return (
      <EmptyState
        icon={UserSquare2}
        title="Matching-Profil ist leer"
        description="Der Kandidat hat den Registrierungsfragebogen (noch) nicht abgeschlossen — ohne Antworten kann kein Score berechnet werden."
      />
    );
  }

  const p = ergebnis.profil.profil;
  const profilZeilen: Array<[string, string]> = [
    ["Gewerk", p.gewerk ? labelFuer("gewerk", p.gewerk) : "—"],
    [
      "Ausbildungsberuf",
      p.ausbildungsberuf ? labelFuer("beruf", p.ausbildungsberuf) : "—",
    ],
    ["Abschluss", p.abschluss ? labelFuer("abschluss", p.abschluss) : "—"],
    [
      "Aufgabenbereiche",
      p.aufgaben.length
        ? p.aufgaben.map((a) => labelFuer("aufgabe", a)).join(", ")
        : "—",
    ],
    ["Erfahrung", p.erfahrung ? labelFuer("erfahrung", p.erfahrung) : "—"],
    [
      "Wünsche",
      p.wuensche.length
        ? p.wuensche.map((x) => labelFuer("wunsch", x)).join(", ")
        : "—",
    ],
    ["Montage", p.montage ? labelFuer("montage", p.montage) : "—"],
    [
      "Führerschein",
      p.fuehrerschein ? labelFuer("fuehrerschein", p.fuehrerschein) : "—",
    ],
    ["Deutsch", p.deutsch ? labelFuer("deutsch", p.deutsch) : "—"],
    ["Start", p.start ? labelFuer("start", p.start) : "—"],
  ];

  return (
    <div className="space-y-4">
      {/* Matching-Profil */}
      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          Matching-Profil des Kandidaten
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {profilZeilen.map(([label, wert]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0 sm:last:border-b">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{wert}</dd>
            </div>
          ))}
        </dl>
        {ergebnis.profil.workLocations.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            Arbeitsorte:
            {ergebnis.profil.workLocations.map((l) => (
              <Badge key={l.id} variant="secondary" className="font-normal">
                {l.label} · {l.radiusKm} km
              </Badge>
            ))}
          </p>
        )}
      </section>

      {/* Bewertete Stellen */}
      {ergebnis.matches.length === 0 ? (
        <EmptyState
          title="Keine aktiven Stellen zum Bewerten"
          description={
            ergebnis.ausgeblendet.gesamt > 0
              ? `Alle ${ergebnis.ausgeblendet.gesamt} aktiven Stellen fallen durch Ausschlusskriterien — Details unten.`
              : "Es gibt derzeit keine aktiven Stellenanzeigen."
          }
        />
      ) : (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Passende Stellen{" "}
            <span className="font-normal text-muted-foreground">
              ({ergebnis.matches.length} bewertet, sortiert nach Match)
            </span>
          </h3>
          {ergebnis.matches.map((m) => (
            <details
              key={m.jobId}
              className="group rounded-lg border bg-card open:shadow-sm"
            >
              <summary className="flex cursor-pointer items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span
                  className={cn(
                    "font-display w-16 shrink-0 text-2xl font-semibold tabular",
                    m.ohneKriterien
                      ? "text-muted-foreground/50"
                      : m.breakdown.score >= 80
                        ? "text-success"
                        : m.breakdown.score >= 50
                          ? "text-foreground"
                          : "text-muted-foreground",
                  )}
                >
                  {m.breakdown.score}%
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/stellen/${m.jobId}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {m.title}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3" />
                    {m.companyId ? (
                      <Link href={`/unternehmen/${m.companyId}`} className="hover:underline">
                        {m.companyName ?? "—"}
                      </Link>
                    ) : (
                      (m.companyName ?? "—")
                    )}
                    {m.city && <span>· {m.city}</span>}
                  </span>
                </span>
                {m.ohneKriterien && (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    ohne bewertbare Kriterien
                  </Badge>
                )}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t px-4 py-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Kriterium</th>
                        <th className="pb-2 font-medium">Gefordert</th>
                        <th className="pb-2 font-medium">Angegeben</th>
                        <th className="pb-2 text-right font-medium">Gewicht</th>
                        <th className="pb-2 pl-4 font-medium">Erfüllung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.breakdown.criteria.map((z) => (
                        <tr
                          key={z.key}
                          className={cn(
                            "border-t border-dashed",
                            z.skipped && "text-muted-foreground/60",
                          )}
                        >
                          <td className="py-1.5 pr-3 font-medium whitespace-nowrap">
                            {z.label}
                          </td>
                          <td className="max-w-48 truncate py-1.5 pr-3" title={z.required}>
                            {z.required}
                          </td>
                          <td className="max-w-48 truncate py-1.5 pr-3" title={z.answer}>
                            {z.answer}
                          </td>
                          <td className="py-1.5 text-right tabular">{z.weight}</td>
                          <td className="py-1.5 pl-4">
                            {z.skipped ? (
                              <span className="text-xs">nicht gewertet</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                  <span
                                    className={cn(
                                      "block h-full rounded-full",
                                      z.fulfilment >= 0.8
                                        ? "bg-success"
                                        : z.fulfilment >= 0.4
                                          ? "bg-primary"
                                          : "bg-destructive",
                                    )}
                                    style={{ width: `${Math.round(z.fulfilment * 100)}%` }}
                                  />
                                </span>
                                <span className="text-xs tabular">
                                  {Math.round(z.fulfilment * 100)}%
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {m.breakdown.criteria.some((z) => !z.skipped && z.note) && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {m.breakdown.criteria
                      .filter((z) => !z.skipped && z.note)
                      .map((z) => (
                        <li key={z.key}>
                          <span className="font-medium">{z.label}:</span> {z.note}
                        </li>
                      ))}
                  </ul>
                )}
                <p className="mt-2 font-mono text-xs text-muted-foreground/70">
                  {m.breakdown.formula}
                </p>
              </div>
            </details>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Basis-Score der Matching-Engine — ohne die persönlichen
            Absage-Abzüge, die die Plattform zusätzlich verrechnet.
          </p>
        </section>
      )}

      {/* Ausgeblendete Stellen */}
      {ergebnis.ausgeblendet.gesamt > 0 && (
        <details className="group rounded-lg border border-dashed bg-card/50">
          <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <EyeOff className="size-4 text-muted-foreground" />
            {ergebnis.ausgeblendet.gesamt}{" "}
            {ergebnis.ausgeblendet.gesamt === 1 ? "Stelle" : "Stellen"} ausgeblendet
            (Ausschlusskriterien)
            <span className="ml-auto flex flex-wrap gap-1.5">
              {Object.entries(ergebnis.ausgeblendet.gruende).map(([grund, anzahl]) => (
                <Badge key={grund} variant="secondary" className="font-normal">
                  {grund} ({anzahl})
                </Badge>
              ))}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Diese Stellen bekommt der Handwerker in seinem Feed gar nicht zu
              sehen — statt mit einem niedrigen Prozentwert.
            </p>
            {ergebnis.ausgeblendet.stellen.map((s) => (
              <div key={s.jobId} className="rounded-md border bg-card px-3 py-2 text-sm">
                <Link href={`/stellen/${s.jobId}`} className="font-medium hover:underline">
                  {s.title}
                </Link>
                {s.companyName && (
                  <span className="text-muted-foreground"> · {s.companyName}</span>
                )}
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {s.gruende.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
