import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDateTime } from "@/lib/format";
import { getMcpConfig } from "./actions";
import { McpControls } from "./_components/mcp-controls";

export const metadata = { title: "KI & MCP-Zugriff" };

interface LogRow {
  id: number;
  created_at: Date;
  tool: string;
  art: string;
  ok: boolean;
  info: string | null;
  argumente: unknown;
}

function kurz(v: unknown, max = 120): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default async function KiEinstellungenPage() {
  const employee = await requireEmployee("settings");
  const canEdit = can(employee, "settings", "edit");
  const config = await getMcpConfig();

  const [log, [stats]] = await Promise.all([
    sql<LogRow[]>`
      select id, created_at, tool, art, ok, info, argumente
      from admin.mcp_log
      order by created_at desc
      limit 100`,
    sql`
      select
        (select count(*)::int from admin.mcp_log) as gesamt,
        (select count(*)::int from admin.mcp_log where art = 'WRITE') as schreibaktionen,
        (select count(*)::int from admin.mcp_log where created_at >= now() - interval '24 hours') as heute,
        (select count(*)::int from admin.mcp_log where not ok) as fehlgeschlagen`,
  ]);
  const s = stats as {
    gesamt: number; schreibaktionen: number; heute: number; fehlgeschlagen: number;
  };

  return (
    <>
      <div className="mb-1">
        <Link
          href="/einstellungen"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Zurück zu den Einstellungen
        </Link>
      </div>
      <PageHeader
        title="KI & MCP-Zugriff"
        description="Steuere den Zugriff der Claude-App auf das Dashboard und sieh jede Aktion — besonders Änderungen — im Protokoll."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Steuerung */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Zugriff steuern</h2>
          <McpControls initial={config} canEdit={canEdit} />
        </section>

        {/* Protokoll */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Aktionen gesamt" value={formatNumber(s.gesamt)} />
            <KpiCard label="Änderungen (Write)" value={formatNumber(s.schreibaktionen)} accent />
            <KpiCard label="Letzte 24 h" value={formatNumber(s.heute)} />
            <KpiCard label="Fehlgeschlagen" value={formatNumber(s.fehlgeschlagen)} />
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-4 py-2.5">
              <h2 className="text-sm font-semibold">Protokoll</h2>
              <p className="text-xs text-muted-foreground">
                Letzte 100 MCP-Aktionen — neueste zuerst.
              </p>
            </div>
            {log.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Noch keine MCP-Aktionen protokolliert.
              </p>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Zeit</th>
                      <th className="px-3 py-2 font-medium">Tool</th>
                      <th className="px-3 py-2 font-medium">Art</th>
                      <th className="px-3 py-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 align-top">
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground tabular">
                          {formatDateTime(r.created_at)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.tool}</td>
                        <td className="px-3 py-2">
                          {r.art === "WRITE" ? (
                            <Badge variant="secondary" className="bg-warning-soft text-warning">
                              Änderung
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Lesen</Badge>
                          )}
                          {!r.ok && (
                            <Badge variant="secondary" className="ml-1 bg-destructive/10 text-destructive">
                              Fehler
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {r.argumente != null && kurz(r.argumente) !== "{}" && (
                            <div className="font-mono">{kurz(r.argumente)}</div>
                          )}
                          {r.info && <div className="mt-0.5">{kurz(r.info, 200)}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
