import { KeyRound, Lock, ShieldCheck, Timer } from "lucide-react";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { KpiCard } from "@/components/common/kpi-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mitarbeiter-Einstellungen" };

const REGELN = [
  { icon: ShieldCheck, title: "2FA verpflichtend", desc: "Jedes Konto richtet beim ersten Login selbst eine Authenticator-App (TOTP) ein. Ohne 2FA kein Zugriff." },
  { icon: KeyRound, title: "Passwort-Richtlinie", desc: "Mindestens 10 Zeichen mit Buchstaben und Ziffern. Passwörter werden ausschließlich als scrypt-Hash gespeichert (nie im Klartext)." },
  { icon: Timer, title: "Sitzungen", desc: "Rollierendes 24-Stunden-Fenster, serverseitig jederzeit widerrufbar. Deaktivieren/Sperren beendet alle aktiven Sitzungen sofort." },
  { icon: Lock, title: "Brute-Force-Schutz", desc: "Login-Rate-Limiting pro IP und Konto; zu viele Fehlversuche sperren die Anmeldung vorübergehend." },
];

export default async function MitarbeiterEinstellungenPage() {
  await requireEmployee("employees");

  const [stats] = await sql`
    select
      (select count(*)::int from admin.employee where deleted_at is null) as total,
      (select count(*)::int from admin.employee where deleted_at is null and status = 'ACTIVE') as active,
      (select count(*)::int from admin.employee where deleted_at is null and totp_enabled = true) as with2fa,
      (select count(*)::int from admin.role) as roles`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Mitarbeiter-Einstellungen"
        description="Sicherheitsregeln und Kennzahlen der Mitarbeiterverwaltung."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Mitarbeiter" value={formatNumber(stats.total as number)} />
        <KpiCard label="Aktiv" value={formatNumber(stats.active as number)} />
        <KpiCard label="Mit 2FA" value={formatNumber(stats.with2fa as number)} />
        <KpiCard label="Templates" value={formatNumber(stats.roles as number)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REGELN.map((r) => (
          <div key={r.title} className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <r.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
