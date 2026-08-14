import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { DokumentWerkbank } from "@/components/dokumente/dokument-werkbank";
import { vorlageFuer } from "@/lib/dokumente/vorlagen";

export default async function BelegVorlagePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireEmployee("communication");
  const { key } = await params;

  const vorlage = vorlageFuer(key);
  if (!vorlage) notFound();

  return (
    <DokumentWerkbank
      felder={vorlage.felder}
      initialWerte={vorlage.werte}
      mitPositionen={vorlage.mitPositionen}
      zurueckHref="/belege"
      zurueckLabel="Zurück zu Belege"
      hinweis="Passe alle Felder an und speichere das Schreiben über „Als PDF drucken“. Der Empfänger bleibt in der Vorlage leer und wird pro Versand ergänzt."
    />
  );
}
