import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Pencil, KeyRound, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Benachrichtigungs-Vorlagen" };

interface Vorlage {
  event: string;
  name: string;
  kategorie: string;
  titel: string;
  enabled: boolean;
}

export default async function BelegePage() {
  await requireEmployee("communication");

  const rows = await sql<Vorlage[]>`
    select event, name, kategorie, titel, enabled
    from admin.benachrichtigung_vorlage
    order by kategorie asc, name asc`;

  const kategorien: string[] = [];
  for (const r of rows) if (!kategorien.includes(r.kategorie)) kategorien.push(r.kategorie);

  return (
    <>
      <PageHeader
        title="Benachrichtigungs-Vorlagen"
        description="Für jedes Ereignis (Kontoerstellung, Löschung, Datenexport, Rechtliches, Sicherheit …) eine Vorlage mit PDF-Vorschau. Zentral bearbeiten — der Versand nach dem Ereignis erfolgt später automatisch."
      />

      <Link
        href="/belege/passwort-reset"
        className="group mb-6 flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Passwort-Reset-E-Mail (Porta Jobs)</span>
          <span className="block text-sm text-muted-foreground">
            Voll gestaltetes E-Mail-Design — jedes Feld &amp; Logo editierbar, Live-Vorschau, Standard wiederherstellbar.
          </span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>

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
