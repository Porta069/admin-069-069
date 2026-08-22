import Link from "next/link";
import { can, requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowUpRight, Bot, Database, Globe, Shield, Tag } from "lucide-react";
import { PricingForm } from "./_components/pricing-form";
import { StatusListEditor } from "./_components/status-list-editor";
import {
  DEFAULT_PRICING,
  readListValue,
} from "./_components/setting-defaults";

function backendHost(): string {
  const url =
    process.env.BACKEND_URL ?? "https://portbackend-069-069.onrender.com/api/v1";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default async function EinstellungenPage() {
  const employee = await requireEmployee("settings");
  const canEdit = can(employee, "settings", "edit");

  const rows = await sql`
    select key, value from admin.setting
    where key in ('pricing', 'candidate_statuses', 'company_statuses', 'note_categories')`;
  const settings = new Map(rows.map((r) => [r.key as string, r.value]));

  const pricingRaw = (settings.get("pricing") ?? {}) as Record<string, unknown>;
  const pricing = {
    base_fee_cents:
      typeof pricingRaw.base_fee_cents === "number"
        ? pricingRaw.base_fee_cents
        : DEFAULT_PRICING.base_fee_cents,
    max_commission_cents:
      typeof pricingRaw.max_commission_cents === "number"
        ? pricingRaw.max_commission_cents
        : DEFAULT_PRICING.max_commission_cents,
    referral_reward_cents:
      typeof pricingRaw.referral_reward_cents === "number"
        ? pricingRaw.referral_reward_cents
        : DEFAULT_PRICING.referral_reward_cents,
    provision_percent:
      typeof pricingRaw.provision_percent === "number"
        ? pricingRaw.provision_percent
        : DEFAULT_PRICING.provision_percent,
  };

  const candidateStatuses = readListValue(
    settings.get("candidate_statuses"),
    "candidate_statuses",
  );
  const noteCategories = readListValue(
    settings.get("note_categories"),
    "note_categories",
  );
  const companyStatuses = readListValue(
    settings.get("company_statuses"),
    "company_statuses",
  );

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Vergütung, Pipeline-Konfiguration und Systeminformationen."
      />

      <div className="grid gap-4">
        <Link
          href="/einstellungen/ki"
          className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">KI &amp; MCP-Zugriff</span>
            <span className="block text-sm text-muted-foreground">
              Zugriff der Claude-App pausieren (komplett oder nur Lesen) und alle
              MCP-Aktionen &amp; Änderungen protokolliert einsehen.
            </span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">
              Vergütung & Prämien
            </CardTitle>
            <CardDescription>
              Beträge für neue Vermittlungen — gespeichert wird centgenau.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingForm
              baseFeeCents={pricing.base_fee_cents}
              maxCommissionCents={pricing.max_commission_cents}
              referralRewardCents={pricing.referral_reward_cents}
              provisionPercent={pricing.provision_percent}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">
              Kandidaten-Pipeline
            </CardTitle>
            <CardDescription>
              Reihenfolge der Pipeline-Status. Entfernen ist nur möglich, wenn
              ein Status nirgends verwendet wird.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusListEditor
              settingKey="candidate_statuses"
              values={candidateStatuses}
              canEdit={canEdit}
              placeholder="Neuer Status, z. B. PROBEARBEIT"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Tag className="size-4 text-muted-foreground" />
                Notiz-Kategorien
              </CardTitle>
              <CardDescription>
                Kategorien für interne Notizen an Kandidaten und Betrieben.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusListEditor
                settingKey="note_categories"
                values={noteCategories}
                canEdit={canEdit}
                placeholder="Neue Kategorie, z. B. Rückruf"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Unternehmens-Status
              </CardTitle>
              <CardDescription>
                Status-Werte für die Betriebs-Pipeline im CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusListEditor
                settingKey="company_statuses"
                values={companyStatuses}
                canEdit={canEdit}
                placeholder="Neuer Status, z. B. PARTNER"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">System</CardTitle>
            <CardDescription>
              Technische Eckdaten der Umgebung — nur zur Information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Globe className="size-3.5" />
                  Backend
                </dt>
                <dd className="mt-1 font-mono text-xs">{backendHost()}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Database className="size-3.5" />
                  DB-Region
                </dt>
                <dd className="mt-1 font-mono text-xs">eu-west-1</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Version
                </dt>
                <dd className="mt-1 font-mono text-xs">v1</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Shield className="size-3.5" />
                  Nachvollziehbarkeit
                </dt>
                <dd className="mt-1">
                  <Link
                    href="/audit"
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                  >
                    Audit & Sicherheit öffnen
                    <ArrowUpRight className="size-3" />
                  </Link>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
