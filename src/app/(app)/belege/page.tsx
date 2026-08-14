import Link from "next/link";
import { ArrowRight, FileSignature } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DOKUMENT_VORLAGEN, type DokumentVorlage } from "@/lib/dokumente/vorlagen";

export const metadata = {
  title: "Belege & Schreiben",
};

/** Vorlagen nach Kategorie gruppieren (Reihenfolge des ersten Auftretens). */
function nachKategorie(): { kategorie: string; vorlagen: DokumentVorlage[] }[] {
  const gruppen: { kategorie: string; vorlagen: DokumentVorlage[] }[] = [];
  for (const v of DOKUMENT_VORLAGEN) {
    let g = gruppen.find((x) => x.kategorie === v.kategorie);
    if (!g) {
      g = { kategorie: v.kategorie, vorlagen: [] };
      gruppen.push(g);
    }
    g.vorlagen.push(v);
  }
  return gruppen;
}

export default async function BelegePage() {
  await requireEmployee("communication");
  const gruppen = nachKategorie();

  return (
    <>
      <PageHeader
        title="Belege & Schreiben"
        description="Fertige PDF-Vorlagen für Anschreiben und Ankündigungen. Vorlage öffnen, Felder anpassen und als PDF drucken oder versenden."
      />

      <div className="space-y-8">
        {gruppen.map((g) => (
          <section key={g.kategorie} className="space-y-3">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {g.kategorie}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.vorlagen.map((v) => (
                <Card key={v.key} className="flex flex-col">
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
                        <FileSignature className="size-4.5" />
                      </span>
                      <Badge variant="secondary" className="text-[11px]">
                        {v.kategorie}
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-sm leading-snug">
                      {v.name}
                    </CardTitle>
                    <CardDescription className="leading-relaxed">
                      {v.beschreibung}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex items-center justify-end pt-4">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/belege/${v.key}`}>
                        Öffnen
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
