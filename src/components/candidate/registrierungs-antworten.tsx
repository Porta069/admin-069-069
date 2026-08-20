import { ClipboardList, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { profilAnzeige } from "@/lib/matching/anzeige";
import { zusatzAntworten } from "@/lib/matching/antworten";

/**
 * Vollständige Registrierungs-Antworten eines Kandidaten — Kern-Profil PLUS alle
 * weiteren Survey-/KI-/Freitext-Antworten. Server-Komponente, damit dieselbe
 * Datenquelle wie die Matching-Engine genutzt wird. Wird sowohl im
 * Kandidatenprofil als auch im Callcenter angezeigt.
 */
export function RegistrierungsAntworten({
  profileData,
  title = "Registrierungs-Antworten",
  className,
}: {
  profileData: unknown;
  title?: string;
  className?: string;
}) {
  const profil = profilAnzeige(profileData);
  const extra = zusatzAntworten(profileData);
  const nichts = profil.leer && extra.length === 0;

  return (
    <section className={cn("rounded-lg border bg-card p-5", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="size-4 text-muted-foreground" />
        {title}
      </h2>

      {nichts ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Für diesen Kandidaten sind noch keine Registrierungs-Antworten hinterlegt.
        </p>
      ) : (
        <>
          {profil.felder.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              {profil.felder.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium">{f.wert}</dd>
                </div>
              ))}
            </dl>
          )}

          {profil.aufgaben.length > 0 && (
            <Block label="Aufgabenfelder">
              {profil.aufgaben.map((a) => (
                <Badge key={a} variant="secondary">{a}</Badge>
              ))}
            </Block>
          )}

          {profil.prioritaeten.length > 0 && (
            <Block label="Prioritäten bei der Jobsuche">
              {profil.prioritaeten.map((p) => (
                <Badge key={p} variant="outline">{p}</Badge>
              ))}
            </Block>
          )}

          {extra.map((a) => (
            <Block key={a.label} label={a.label}>
              {a.werte.map((w, i) => (
                <Badge key={`${a.label}-${i}`} variant="outline">{w}</Badge>
              ))}
            </Block>
          ))}

          {profil.arbeitsorte.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Arbeitsorte
              </p>
              <ul className="mt-2 space-y-1">
                {profil.arbeitsorte.map((o, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>{o.label}</span>
                    <span className="text-muted-foreground">· {o.radiusKm} km Radius</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
