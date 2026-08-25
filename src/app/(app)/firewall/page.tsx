import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Lock,
  Activity,
  Ban,
} from "lucide-react";
import { FirewallRules, type RuleRow } from "./_components/firewall-rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "Firewall" };

const REASON_LABEL: Record<string, string> = {
  exploit_pfad: "Exploit-Pfad",
  scanner_ua: "Scanner",
  injection_query: "Injection",
  rate_limit: "Rate-Limit",
  ip_blockliste: "IP-Blockliste",
  ip_regel_node: "IP-Regel",
};
function reasonLabel(r: string): string {
  if (REASON_LABEL[r]) return REASON_LABEL[r];
  if (r.startsWith("methode_")) return `Methode ${r.slice(8).toUpperCase()}`;
  return r;
}

export default async function FirewallPage() {
  const employee = await requireEmployee();
  if (employee.roleId !== "SUPERADMIN") {
    return (
      <>
        <PageHeader title="Firewall" description="Perimeter-Schutz des Dashboards." />
        <EmptyState
          icon={Lock}
          title="Nur für das Master-Konto"
          description="Die Firewall-Verwaltung ist dem Superadmin-Konto vorbehalten."
        />
      </>
    );
  }

  const [events, [stats], topIps, ruleRows, [loginFails]] = await Promise.all([
    sql`
      select id, ip, method, path, reason, action, user_agent, created_at
      from admin.firewall_event
      order by created_at desc limit 60`,
    sql`
      select
        count(*) filter (where created_at > now() - interval '24 hours')::int as ereignisse_24h,
        count(*) filter (where created_at > now() - interval '24 hours'
                         and action = 'RATE_LIMIT')::int as ratelimit_24h,
        count(*) filter (where created_at > now() - interval '24 hours'
                         and action = 'BLOCK')::int as block_24h
      from admin.firewall_event`,
    sql`
      select ip, count(*)::int as anzahl
      from admin.firewall_event
      where created_at > now() - interval '24 hours' and ip is not null
      group by ip order by anzahl desc limit 8`,
    sql`
      select id, rule_type, pattern, note, created_at
      from admin.firewall_rule
      where deleted_at is null
      order by rule_type, created_at desc`,
    sql`
      select count(*)::int as fails
      from admin.login_event
      where success = false and created_at > now() - interval '24 hours'`,
  ]);

  const rules = ruleRows as unknown as RuleRow[];
  const aktiv = process.env.FIREWALL_ENABLED !== "false";
  const modus = process.env.FIREWALL_MODE === "monitor" ? "Beobachten" : "Blockieren";
  const edgeLog = Boolean(process.env.FIREWALL_LOG_TOKEN);
  const allowEnv = (process.env.FIREWALL_ALLOW_IPS ?? "").split(",").filter((s) => s.trim()).length;
  const blockEnv = (process.env.FIREWALL_BLOCK_IPS ?? "").split(",").filter((s) => s.trim()).length;

  return (
    <>
      <PageHeader
        title="Firewall"
        description="Perimeter-Schutz: Edge-WAF (Scanner, Exploits, Rate-Limit) und dynamische IP-Regeln."
        actions={
          <Badge
            variant={aktiv ? "secondary" : "destructive"}
            className="gap-1.5"
          >
            {aktiv ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
            {aktiv ? `Aktiv · ${modus}` : "Deaktiviert"}
          </Badge>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Ereignisse (24 h)"
          value={stats.ereignisse_24h as number}
          hint="von der Firewall erfasst"
          accent
        />
        <KpiCard
          label="Blockiert (24 h)"
          value={stats.block_24h as number}
          hint="Exploits, Scanner, Bans"
        />
        <KpiCard
          label="Rate-Limits (24 h)"
          value={stats.ratelimit_24h as number}
          hint="gedrosselte Fluten"
        />
        <KpiCard
          label="Fehl-Logins (24 h)"
          value={loginFails.fails as number}
          hint="falsche Zugangsdaten"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Ereignis-Log */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Activity className="size-4 text-muted-foreground" /> Letzte Ereignisse
            </h2>
            {events.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Noch keine Ereignisse"
                description="Sobald die Firewall etwas blockiert, erscheint es hier. Edge-Ereignisse werden nur mit gesetztem FIREWALL_LOG_TOKEN protokolliert."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Zeit</TableHead>
                      <TableHead>Grund</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Pfad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e) => (
                      <TableRow key={e.id as string}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                          {formatDateTime(e.created_at as Date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={e.action === "RATE_LIMIT" ? "outline" : "destructive"}
                            className="text-[10px]"
                          >
                            {reasonLabel(e.reason as string)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {(e.ip as string | null) ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={e.path as string}>
                          {(e.method as string) ? `${e.method} ` : ""}
                          {(e.path as string | null) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Dynamische IP-Regeln */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <Ban className="size-4 text-muted-foreground" /> IP-Regeln
            </h2>
            <FirewallRules rules={rules} />
          </section>
        </div>

        <div className="space-y-5">
          {/* Konfiguration */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <ShieldAlert className="size-4 text-muted-foreground" /> Konfiguration
            </h2>
            <dl className="space-y-2.5 text-sm">
              <ConfigRow label="Status" value={aktiv ? "Aktiv" : "Deaktiviert"} ok={aktiv} />
              <ConfigRow label="Modus" value={modus} ok={modus === "Blockieren"} />
              <ConfigRow label="Edge-Logging" value={edgeLog ? "An" : "Aus (Token fehlt)"} ok={edgeLog} />
              <ConfigRow label="Allowlist (Env)" value={`${allowEnv} IP(s)`} />
              <ConfigRow label="Blocklist (Env)" value={`${blockEnv} IP(s)`} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Steuerung über Env: <code>FIREWALL_ENABLED</code>,{" "}
              <code>FIREWALL_MODE</code> (block/monitor),{" "}
              <code>FIREWALL_ALLOW_IPS</code>, <code>FIREWALL_BLOCK_IPS</code>,{" "}
              <code>FIREWALL_LOG_TOKEN</code>.
            </p>
          </section>

          {/* Top-Angreifer */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
              <ShieldX className="size-4 text-muted-foreground" /> Top-IPs (24 h)
            </h2>
            {topIps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine auffälligen IPs.</p>
            ) : (
              <ul className="space-y-1.5">
                {topIps.map((t) => (
                  <li key={t.ip as string} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-mono text-xs">{t.ip as string}</span>
                    <Badge variant="secondary" className="tabular">{t.anzahl as number}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ConfigRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          ok === undefined
            ? "font-medium"
            : ok
              ? "font-medium text-success"
              : "font-medium text-warning"
        }
      >
        {value}
      </dd>
    </div>
  );
}
