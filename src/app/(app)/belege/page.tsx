import Link from "next/link";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Pencil } from "lucide-react";
import { AutonomerVersandSchalter } from "./_components/autonomer-versand-schalter";

export const metadata = { title: "Benachrichtigungs-Vorlagen" };

interface Vorlage {
  event: string;
  name: string;
  kategorie: string;
  titel: string;
  enabled: boolean;
}

export default async function BelegePage() {
  const employee = await requireEmployee("communication");

  const [rows, [versandRow]] = await Promise.all([
    sql<Vorlage[]>`
      select event, name, kategorie, titel, enabled
      from admin.benachrichtigung_vorlage
      order by kategorie asc, name asc`,
    sql`select value from admin.setting where key = 'autonomer_versand'`,
  ]);
  const versandAktiv =
    ((versandRow?.value ?? {}) as Record<string, unknown>).aktiv === true;
  const canEdit = can(employee, "communication", "edit");

  const kategorien: string[] = [];
  for (const r of rows) if (!kategorien.includes(r.kategorie)) kategorien.push(r.kategorie);

  return (
    <>
      <PageHeader
        title="Benachrichtigungs-Vorlagen"
        description="Für jedes Ereignis (Kontoerstellung, Löschung, Datenexport, Rechtliches, Sicherheit …) eine Vorlage mit PDF-Vorschau. Eine Vorlage feuert automatisch nur, wenn der autonome Versand global an UND die Vorlage aktiv ist."
      />

      <AutonomerVersandSchalter aktiv={versandAktiv} disabled={!canEdit} />

      <div className="space-y-8">
        {kategorien.map((kat) => (
          <section key={kat}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{kat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows
                .filter((r) => r.kategorie === kat)
                .map((r) => (
                  <Link
                    key={r.event}
                    href={`/belege/${r.event}`}
                    className="group flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileSignature className="size-4.5" />
                      </span>
                      {r.enabled ? (
                        <Badge variant="secondary" className="bg-success-soft text-success">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inaktiv</Badge>
                      )}
                    </div>
                    <p className="mt-3 font-medium">{r.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {r.titel}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Pencil className="size-3.5" />
                      Bearbeiten &amp; Vorschau
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
