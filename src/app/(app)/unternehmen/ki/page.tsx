import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { kiVerfuegbar } from "@/lib/ki-intake";
import { PageHeader } from "@/components/common/page-header";
import { KiIntake } from "./_components/ki-intake";
import { ArrowLeft, KeyRound } from "lucide-react";

export const metadata = { title: "Mit KI anlegen" };

export default async function KiIntakePage() {
  await requireEmployee("companies", "create");
  const aktiv = kiVerfuegbar();

  return (
    <>
      <div className="mb-1">
        <Link
          href="/unternehmen"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Unternehmen
        </Link>
      </div>
      <PageHeader
        title="Unternehmen & Jobs mit KI anlegen"
        description="Beliebigen Text einfügen — Website, E-Mail, Notizen, Stellenanzeigen, auch alles zusammen. Die KI extrahiert Unternehmensprofil und Inserate, stellt Rückfragen bei Lücken, und du prüfst alles vor dem Anlegen."
      />

      {!aktiv && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">KI-Extraktion noch nicht aktiviert</p>
            <p className="mt-0.5">
              Es fehlt der <code className="font-mono">ANTHROPIC_API_KEY</code> in
              den Umgebungsvariablen (Vercel bzw. .env.local). Sobald er gesetzt
              ist, funktioniert diese Seite sofort — der manuelle Weg über
              „Unternehmen anlegen" und „Stelle anlegen" geht jederzeit.
            </p>
          </div>
        </div>
      )}

      <KiIntake aktiv={aktiv} />
    </>
  );
}
