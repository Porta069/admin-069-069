import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { kiVerfuegbar } from "@/lib/ki";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { AssistantChat } from "./_components/assistant-chat";
import { Activity, Sparkles } from "lucide-react";

interface UsageRow {
  feature: string;
  calls: number;
  input: number;
  output: number;
}

async function KiUsagePanel() {
  const rows = (await sql`
    select feature,
           count(*)::int as calls,
           coalesce(sum(input_tokens), 0)::bigint as input,
           coalesce(sum(output_tokens), 0)::bigint as output
    from admin.ki_usage
    where created_at >= now() - interval '7 days'
    group by feature
    order by calls desc`) as unknown as UsageRow[];

  const totalCalls = rows.reduce((s, r) => s + Number(r.calls), 0);
  const totalTokens = rows.reduce((s, r) => s + Number(r.input) + Number(r.output), 0);

  return (
    <div className="mt-6 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Activity className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">KI-Nutzung</h2>
        <span className="text-xs text-muted-foreground">letzte 7 Tage</span>
        <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          nur für Superadmin
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Aufrufe
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular">
            {formatNumber(totalCalls)}
          </p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Tokens
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular">
            {formatNumber(totalTokens)}
          </p>
        </div>
        <div className="col-span-2 bg-card p-4 sm:col-span-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Provider
          </p>
          <p className="mt-1.5 text-sm font-medium">
            {kiVerfuegbar() ? (
              <span className="text-success">verbunden</span>
            ) : (
              <span className="text-muted-foreground">nicht verbunden</span>
            )}
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Nach Funktion</p>
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.feature} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {r.feature}
                </span>
                <span className="text-xs text-muted-foreground tabular">
                  {formatNumber(Number(r.calls))} Aufrufe
                </span>
                <span className="w-24 text-right text-xs text-muted-foreground tabular">
                  {formatNumber(Number(r.input) + Number(r.output))} Tk.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function AssistentPage() {
  // Route ist module-frei: jeder eingeloggte Mitarbeiter darf die Seite öffnen.
  // Der Datenzugriff pro Frage wird in der Server Action streng nach Rechten geprüft.
  const employee = await requireEmployee();
  const istSuperadmin = employee.roleId === "SUPERADMIN";

  return (
    <>
      <PageHeader
        title="KI-Assistent"
        description="Fragen zu Kandidaten, Betrieben und Aufgaben — beantwortet aus deinen Dashboard-Daten."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {kiVerfuegbar() ? "KI aktiv" : "Ohne KI-Provider"}
          </span>
        }
      />

      <AssistantChat />

      {!kiVerfuegbar() && (
        <p className="mt-3 text-xs text-muted-foreground">
          Der KI-Provider ist nicht verbunden. Listen, Matches und Fakten
          funktionieren trotzdem — nur die frei formulierten Zusammenfassungen und
          E-Mail-Entwürfe folgen nach dem Verbinden.
        </p>
      )}

      {istSuperadmin && <KiUsagePanel />}
    </>
  );
}
