import { notFound } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { VorlagenEditor } from "../_components/vorlagen-editor";

interface Variable {
  key: string;
  label: string;
  beispiel: string;
}

export default async function VorlagePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireEmployee("communication");
  const { key } = await params;

  const [v] = await sql`
    select event, name, kategorie, titel, betreff, einleitung, schluss,
           hervorhebung, variante, variablen, enabled
    from admin.benachrichtigung_vorlage
    where event = ${key} limit 1`;
  if (!v) notFound();

  const variablen = (Array.isArray(v.variablen) ? v.variablen : []) as Variable[];

  return (
    <>
      <PageHeader
        title={v.name as string}
        description={`Ereignis-Vorlage · ${v.kategorie as string}`}
      />
      <VorlagenEditor
        event={v.event as string}
        name={v.name as string}
        variablen={variablen}
        initial={{
          titel: (v.titel as string) ?? "",
          betreff: (v.betreff as string) ?? "",
          einleitung: (v.einleitung as string) ?? "",
          schluss: (v.schluss as string) ?? "",
          hervorhebung: (v.hervorhebung as string) ?? "",
          variante: (v.variante as string) ?? "brief",
          enabled: Boolean(v.enabled),
        }}
      />
    </>
  );
}
