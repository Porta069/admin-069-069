import { requireEmployee } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { HilfeZentrale } from "./_components/hilfe-zentrale";

export const metadata = { title: "Hilfe-Zentrale" };

export default async function HilfePage() {
  await requireEmployee();

  return (
    <>
      <PageHeader
        title="Hilfe-Zentrale"
        description="Alle Funktionen des Dashboards erklärt und durchsuchbar. Neu-markierte Punkte sind die neuesten Erweiterungen."
      />
      <HilfeZentrale />
    </>
  );
}
