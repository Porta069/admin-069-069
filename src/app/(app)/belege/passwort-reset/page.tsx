import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireEmployee, can } from "@/lib/auth";
import { PageHeader } from "@/components/common/page-header";
import { getResetEmailConfig } from "@/lib/reset-email-store";
import { ResetEmailEditor } from "./_components/reset-email-editor";

export const metadata = { title: "Passwort-Reset-E-Mail" };

export default async function ResetEmailPage() {
  const employee = await requireEmployee("communication");
  const canEdit = can(employee, "communication", "edit");
  const config = await getResetEmailConfig();

  return (
    <>
      <div className="mb-1">
        <Link
          href="/belege"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Zurück zu den Benachrichtigungs-Vorlagen
        </Link>
      </div>
      <PageHeader
        title="Passwort-Reset-E-Mail"
        description={`Design der „Passwort zurücksetzen“-E-Mail (Porta Jobs). Jedes Feld und das Logo sind editierbar — der Standard bleibt jederzeit wiederherstellbar.`}
      />
      <ResetEmailEditor
        initial={config}
        canEdit={canEdit}
        testEmail={employee.email}
      />
    </>
  );
}
