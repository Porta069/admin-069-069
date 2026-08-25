import Link from "next/link";
import { ArrowLeft, Repeat, CircleDollarSign } from "lucide-react";
import { requireEmployee, can } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatDate, formatEuroCents } from "@/lib/format";
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
  proMonatCents,
  proJahrCents,
  summiere,
  INTERVALL_LABEL,
  type FixItem,
  type FixKind,
  type FixIntervall,
} from "@/lib/fixkosten-berechnung";
import { FixkostenDialog } from "./_components/fixkosten-dialog";
import {
  BelegButton,
  DeleteFixedCostButton,
} from "./_components/fixkosten-row-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fixkosten" };

interface Row {
  id: string;
  bezeichnung: string;
  kind: FixKind;
  intervall: FixIntervall | null;
  amount_cents: string | number;
  kategorie: string | null;
  faellig_on: Date | null;
  invoice_path: string | null;
  invoice_name: string | null;
}

export default async function FixkostenPage() {
  const employee = await requireEmployee("rewards");
  const canCreate = can(employee, "rewards", "create");
  const canDelete = can(employee, "rewards", "delete");

  const rows = (await sql`
    select id, bezeichnung, kind, intervall, amount_cents, kategorie,
           faellig_on, invoice_path, invoice_name
    from admin.fixed_cost
    where deleted_at is null
    order by (kind = 'EINMALIG'), intervall nulls last, created_at desc`) as Row[];

  const items: FixItem[] = rows.map((r) => ({
    kind: r.kind,
    intervall: r.intervall,
    amountCents: Number(r.amount_cents),
  }));
  const s = summiere(items);

  return (
    <div>
      <Link
        href="/finanzen"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Finanzen
      </Link>
      <PageHeader
        title="Fixkosten & Einmalzahlungen"
        description="Laufende Kosten und Einmalzahlungen — automatisch auf pro Monat und pro Jahr umgerechnet."
        actions={canCreate ? <FixkostenDialog /> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Gesamt pro Monat"
          value={formatEuroCents(s.gesamtProMonat)}
          hint="laufend + Einmalzahlungen anteilig"
          accent
        />
        <KpiCard
          label="Gesamt pro Jahr"
          value={formatEuroCents(s.gesamtProJahr)}
          hint="laufend × 12 + Einmalzahlungen"
          accent
        />
        <KpiCard
          label="Laufende Kosten / Monat"
          value={formatEuroCents(s.laufendProMonat)}
          hint={`${formatEuroCents(s.laufendProJahr)} pro Jahr`}
        />
        <KpiCard
          label="Einmalzahlungen"
          value={formatEuroCents(s.einmaligGesamt)}
          hint={`${formatEuroCents(s.einmaligProMonat)} / Monat anteilig`}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Noch keine Fixkosten erfasst"
          description="Erfasse laufende Kosten (monatlich/jährlich) oder Einmalzahlungen — alles wird automatisch umgerechnet."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="text-right">/ Monat</TableHead>
                <TableHead className="text-right">/ Jahr</TableHead>
                <TableHead>Beleg</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const item: FixItem = {
                  kind: r.kind,
                  intervall: r.intervall,
                  amountCents: Number(r.amount_cents),
                };
                const einmalig = r.kind === "EINMALIG";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.bezeichnung}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          r.kategorie,
                          r.faellig_on ? formatDate(r.faellig_on) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {einmalig ? (
                        <Badge variant="secondary" className="gap-1">
                          <CircleDollarSign className="size-3" /> Einmalzahlung
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Repeat className="size-3" />
                          {r.intervall ? INTERVALL_LABEL[r.intervall] : "laufend"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {formatEuroCents(Number(r.amount_cents))}
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">
                      {formatEuroCents(proMonatCents(item))}
                    </TableCell>
                    <TableCell className="text-right tabular text-muted-foreground">
                      {formatEuroCents(proJahrCents(item))}
                    </TableCell>
                    <TableCell>
                      {r.invoice_path ? (
                        <BelegButton id={r.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canDelete && (
                        <DeleteFixedCostButton id={r.id} bezeichnung={r.bezeichnung} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
