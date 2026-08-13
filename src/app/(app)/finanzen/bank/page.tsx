import Link from "next/link";
import {
  Landmark,
  Info,
  ArrowLeft,
  ArrowLeftRight,
  Link2,
} from "lucide-react";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
import type { StatusDef } from "@/lib/definitions";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CreateAccountDialog } from "./_components/create-account-dialog";
import {
  CreateTransactionDialog,
  type AccountOption,
} from "./_components/create-transaction-dialog";
import { MatchDialog } from "./_components/match-dialog";
import { AccountActions } from "./_components/account-actions";

const BANK_ACCOUNT_STATUS: Record<string, StatusDef> = {
  VORBEREITET: { label: "Vorbereitet", tone: "info" },
  VERBUNDEN: { label: "Verbunden", tone: "success" },
  GETRENNT: { label: "Getrennt", tone: "neutral" },
};

const BANK_TRANSACTION_STATUS: Record<string, StatusDef> = {
  UNMATCHED: { label: "Nicht zugeordnet", tone: "warning" },
  MATCHED: { label: "Zugeordnet", tone: "success" },
  IGNORED: { label: "Ignoriert", tone: "neutral" },
};

/** IBAN nur maskiert anzeigen — die vollständige IBAN verlässt den Server nie. */
function maskIban(iban: string | null): string {
  if (!iban) return "—";
  const compact = iban.replace(/\s+/g, "");
  if (compact.length <= 4) return compact;
  return `•••• ${compact.slice(-4)}`;
}

export default async function BankPage() {
  const employee = await requireEmployee("rewards");
  const canCreate = can(employee, "rewards", "create");
  const canDelete = can(employee, "rewards", "delete");

  const [accounts, transactions, [kpi]] = await Promise.all([
    sql`
      select id, name, bank_name, iban, bic, status, balance_cents
      from admin.bank_account
      where deleted_at is null
      order by created_at asc`,
    sql`
      select t.id, t.booked_at, t.amount_cents, t.purpose,
             t.counterparty_name, t.status,
             t.matched_invoice_id, i.nummer as matched_nummer
      from admin.bank_transaction t
      left join admin.invoice i on i.id = t.matched_invoice_id
      order by t.booked_at desc, t.created_at desc
      limit 100`,
    sql`
      select
        (select count(*)::int from admin.bank_account where deleted_at is null) as account_count,
        (select count(*)::int from admin.bank_transaction
           where status = 'UNMATCHED' and amount_cents > 0) as unmatched_count,
        (select coalesce(sum(amount_cents), 0)::bigint from admin.bank_transaction
           where status = 'UNMATCHED' and amount_cents > 0) as unmatched_sum`,
  ]);

  const accountOptions: AccountOption[] = accounts.map((a) => ({
    id: a.id as string,
    name: a.name as string,
  }));

  const accountCount = Number(kpi?.account_count ?? 0);
  const unmatchedCount = Number(kpi?.unmatched_count ?? 0);
  const unmatchedSum = Number(kpi?.unmatched_sum ?? 0);

  return (
    <>
      <PageHeader
        title="Bankanbindung"
        description="Bankkonten, Kontobewegungen und der automatische Rechnungsabgleich — vorbereitet für die kommende Bank-Synchronisierung."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finanzen">
              <ArrowLeft className="size-4" />
              Zur Finanzübersicht
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-dashed bg-muted/40 p-3.5 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          <span className="font-medium text-foreground">Vorbereitungsmodus.</span>{" "}
          Die automatische Synchronisierung mit der Bank (Kontostand &amp;
          Umsätze) sowie der CSV-Import folgen. Bis dahin lassen sich Konten und
          Buchungen manuell erfassen — der Abgleich von Zahlungseingängen zu
          offenen Rechnungen funktioniert bereits.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard
          label="Bankkonten"
          value={accountCount}
          hint="aktiv hinterlegt"
        />
        <KpiCard
          label="Nicht zugeordnet"
          value={unmatchedCount}
          hint="offene Zahlungseingänge"
        />
        <KpiCard
          label="Summe unzugeordnet"
          value={formatEuroCents(unmatchedSum)}
          hint="noch keiner Rechnung zugewiesen"
          accent
        />
      </div>

      {/* Bankkonten */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Bankkonten
          </h2>
          {canCreate && <CreateAccountDialog />}
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Noch kein Bankkonto"
            description="Lege ein Konto an, um Kontobewegungen zu erfassen und Zahlungseingänge zuzuordnen."
            action={canCreate ? <CreateAccountDialog /> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => (
              <div
                key={a.id as string}
                className="relative flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Landmark className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.name as string}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(a.bank_name as string | null) ?? "—"}
                      </p>
                    </div>
                  </div>
                  {canDelete && (
                    <AccountActions id={a.id as string} canDelete={canDelete} />
                  )}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm tracking-wide">
                      {maskIban(a.iban as string | null)}
                    </p>
                    <div className="mt-1.5">
                      <StatusBadge
                        map={BANK_ACCOUNT_STATUS}
                        value={a.status as string}
                      />
                    </div>
                  </div>
                  <p className="tabular text-right text-sm font-semibold">
                    {formatEuroCents(Number(a.balance_cents ?? 0))}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full"
                  title="Bank-Synchronisierung folgt"
                >
                  <Link2 className="size-4" />
                  Verbinden (folgt)
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Kontobewegungen */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Kontobewegungen
          </h2>
          <div className="flex items-center gap-2">
            <MatchDialog />
            {canCreate && (
              <CreateTransactionDialog accounts={accountOptions} />
            )}
          </div>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Noch keine Kontobewegungen"
            description="Erfasse eine Buchung manuell zum Testen. Der automatische CSV-Import und die Bank-Synchronisierung folgen."
            action={
              canCreate && accounts.length > 0 ? (
                <CreateTransactionDialog accounts={accountOptions} />
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead>Gegenpartei</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rechnung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => {
                  const amount = Number(t.amount_cents ?? 0);
                  const incoming = amount > 0;
                  return (
                    <TableRow key={t.id as string}>
                      <TableCell className="tabular text-muted-foreground">
                        {formatDate(t.booked_at as string)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular text-right font-medium",
                          incoming ? "text-success" : "text-destructive",
                        )}
                      >
                        {incoming ? "+" : ""}
                        {formatEuroCents(amount)}
                      </TableCell>
                      <TableCell className="max-w-[22ch] truncate">
                        {(t.purpose as string | null) ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[18ch] truncate">
                        {(t.counterparty_name as string | null) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          map={BANK_TRANSACTION_STATUS}
                          value={t.status as string}
                        />
                      </TableCell>
                      <TableCell>
                        {t.matched_invoice_id ? (
                          <Link
                            href={`/finanzen/${t.matched_invoice_id as string}`}
                            className="font-mono text-sm font-medium hover:underline"
                          >
                            {(t.matched_nummer as string | null) ?? "Rechnung"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
