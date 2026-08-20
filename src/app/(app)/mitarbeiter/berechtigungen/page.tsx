import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { MODULE_LABELS, RBAC_MODULES, RBAC_ACTIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Berechtigungen" };

export default async function BerechtigungenPage() {
  await requireEmployee("employees");

  return (
    <div>
      <PageHeader
        title="Berechtigungen"
        description="Das Rechtemodell: Modul × Aktion. Durchgesetzt wird ausschließlich serverseitig."
      />

      <div className="mb-6 rounded-lg border bg-card p-5">
        <h2 className="mb-2 font-display text-sm font-semibold">So funktioniert es</h2>
        <p className="text-sm text-muted-foreground">
          Jede Berechtigung besteht aus einem <strong>Modul</strong> (z. B. Bewerber) und einer{" "}
          <strong>Aktion</strong> (Ansehen, Erstellen, Bearbeiten …). Rechte werden über{" "}
          <Link href="/rollen" className="font-medium text-primary hover:underline">Templates</Link>{" "}
          gebündelt und beim Anlegen eines Mitarbeiters übernommen. Im Mitarbeiterprofil lassen sie sich
          zusätzlich individuell anpassen. Ohne Berechtigung wird ein Bereich weder in der Navigation
          angezeigt noch geöffnet, und auch die zugehörigen Server-Aktionen werden blockiert.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {RBAC_ACTIONS.map((a) => (
          <span key={a.key} className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium">
            {a.label}
          </span>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RBAC_MODULES.map((m) => (
          <div key={m} className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">{MODULE_LABELS[m]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Modul-Schlüssel: {m}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
