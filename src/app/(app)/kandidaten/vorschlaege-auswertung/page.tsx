import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Sparkles } from "lucide-react";

export const metadata = { title: "Vorschlags-Auswertung" };

const QUELLE_LABELS: Record<string, string> = {
  ADMIN: "Handauswahl (ADMIN)",
  AUTOMATION: "Automatisch (AUTOMATION)",
};

interface Agg {
  gesamt: number;
  angenommen: number;
  abgelehnt: number;
  offen: number;
}

/**
 * Annahmequote der Kandidatenvorschläge nach Quelle — liest die
 * Plattform-Tabelle public."CandidateSuggestion" direkt (nur Lesen). Zeigt, ob
 * die Automatisierung besser trifft als die Handauswahl.
 */
export default async function VorschlaegeAuswertungPage() {
  await requireEmployee("placements");

  const rows = await sql<{ quelle: string; status: string; anzahl: number }[]>`
    select quelle::text as quelle, status::text as status, count(*)::int as anzahl
    from public."CandidateSuggestion"
    group by quelle, status`;

  const byQuelle = new Map<string, Agg>();
  for (const r of rows) {
    const a = byQuelle.get(r.quelle) ?? { gesamt: 0, angenommen: 0, abgelehnt: 0, offen: 0 };
    a.gesamt += r.anzahl;
    if (r.status === "INTERESTED" || r.status === "APPROVED") a.angenommen += r.anzahl;
    else if (r.status === "DECLINED") a.abgelehnt += r.anzahl;
    else a.offen += r.anzahl;
    byQuelle.set(r.quelle, a);
  }
  // Bekannte Quellen zuerst, danach jede weitere real vorkommende Quelle —
  // so bekommt auch ein dritter Backend-Wert eine Karte statt nur „gesamt" zu erhöhen.
  const bekannt = ["ADMIN", "AUTOMATION"];
  const quellen = [
    ...bekannt.filter((q) => byQuelle.has(q)),
    ...[...byQuelle.keys()].filter((q) => !bekannt.includes(q)).sort(),
  ];
  const gesamt = rows.reduce((s, r) => s + r.anzahl, 0);

  return (
    <>
      <PageHeader
        title="Vorschlags-Auswertung"
        description="Annahmequote der Kandidatenvorschläge nach Quelle — misst, ob die Automatisierung besser trifft als die Handauswahl."
      />
      {gesamt === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Noch keine Vorschläge"
          description="Sobald Vorschläge angelegt und von den Betrieben beantwortet wurden, erscheint hier die Annahmequote je Quelle."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {quellen.map((q) => {
              const a = byQuelle.get(q)!;
              const entschieden = a.angenommen + a.abgelehnt;
              const quote =
                entschieden > 0 ? Math.round((100 * a.angenommen) / entschieden) : null;
              return (
                <section key={q} className="rounded-lg border bg-card p-5">
                  <h2 className="font-display text-sm font-semibold">
                    {QUELLE_LABELS[q] ?? q}
                  </h2>
                  <p className="mt-1 text-3xl font-semibold tabular">
                    {quote != null ? `${quote}%` : "—"}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      Annahmequote
                    </span>
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Gesamt</p>
                      <p className="mt-0.5 font-medium tabular">{a.gesamt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Angenommen</p>
                      <p className="mt-0.5 font-medium text-success tabular">{a.angenommen}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Abgelehnt</p>
                      <p className="mt-0.5 font-medium text-destructive tabular">{a.abgelehnt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Offen</p>
                      <p className="mt-0.5 font-medium tabular">{a.offen}</p>
                    </div>
                  </div>
                  {entschieden === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Noch keine entschiedenen Vorschläge — die Quote erscheint,
                      sobald der Betrieb antwortet.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Annahmequote = Angenommen / (Angenommen + Abgelehnt). „Angenommen" =
            Status „Interessiert"/„Freigegeben"; „Offen" = noch nicht beantwortet
            (zählt nicht in die Quote).
          </p>
        </div>
      )}
    </>
  );
}
