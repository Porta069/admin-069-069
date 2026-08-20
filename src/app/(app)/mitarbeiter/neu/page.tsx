import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isFullAccess } from "@/lib/rbac";
import { PageHeader } from "@/components/common/page-header";
import { CreateEmployeeForm } from "../_components/create-employee-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mitarbeiter hinzufügen" };

export default async function MitarbeiterNeuPage() {
  const actor = await requireEmployee("employees", "create");
  const master = isFullAccess(actor.permissions);

  const roles = await sql`
    select r.id, r.name, r.level,
           (select count(*)::int from admin.employee e where e.role_id = r.id and e.deleted_at is null) as count
    from admin.role r
    order by r.level desc, r.name`;

  // Nur Templates, die der Handelnde vergeben darf (nie ≥ eigene Stufe, außer Master).
  const assignable = roles
    .filter((r) => master || ((r.level as number) < actor.roleLevel && r.id !== "SUPERADMIN"))
    .map((r) => ({ id: r.id as string, name: r.name as string, count: r.count as number }));

  return (
    <div>
      <Link href="/mitarbeiter" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Mitarbeiter
      </Link>
      <PageHeader
        title="Mitarbeiter hinzufügen"
        description="Neues Konto anlegen, Template zuweisen — Berechtigungen werden übernommen."
      />
      {assignable.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Es stehen keine Templates zur Verfügung, die du vergeben darfst.
        </p>
      ) : (
        <CreateEmployeeForm roles={assignable} />
      )}
    </div>
  );
}
