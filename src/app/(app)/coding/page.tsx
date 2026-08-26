import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Lock } from "lucide-react";
import { CodingBoard, type CodingTask } from "./_components/coding-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coding" };

export default async function CodingPage() {
  const employee = await requireEmployee();
  if (employee.roleId !== "SUPERADMIN") {
    return (
      <>
        <PageHeader title="Coding" description="Interne Entwicklungs-Checkliste." />
        <EmptyState
          icon={Lock}
          title="Nur für das Master-Konto"
          description="Die Entwicklungs-Checkliste ist dem Superadmin-Konto vorbehalten."
        />
      </>
    );
  }

  const rows = (await sql`
    select id, titel, beschreibung, kategorie, prioritaet, erledigt
    from admin.coding_task
    where deleted_at is null
    order by kategorie, sortier, created_at`) as CodingTask[];

  return (
    <>
      <PageHeader
        title="Coding"
        description="Selbst gepflegte Checkliste: was noch fehlt — und was erledigt ist. Wird laufend aktualisiert und abgehakt."
      />
      <CodingBoard tasks={rows} />
    </>
  );
}
