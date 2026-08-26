import { headers } from "next/headers";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { formatDateTime } from "@/lib/format";
import {
  ChangePasswordForm,
  IcalSection,
  NtfySection,
  TotpSetup,
  UsernameForm,
} from "./_components/account-forms";
import { AvatarUpload, ProfileForm } from "./_components/profile-forms";
import { avatarStorageAktiv } from "@/lib/storage";
import { KeyRound, Smartphone } from "lucide-react";

export const metadata = { title: "Mein Konto" };

export default async function KontoPage({
  searchParams,
}: {
  searchParams: Promise<{ erst?: string; "2fa"?: string }>;
}) {
  const employee = await requireEmployee();
  const params = await searchParams;
  const erst = params.erst;
  const zweiFaktorPflicht = params["2fa"] === "1";

  const [row] = await sql`
    select ical_token, last_login_at, created_at, username,
           first_name, last_name, phone, ntfy_topic, ntfy_prefs,
           avatar_source_url, avatar_crop
    from admin.employee where id = ${employee.id}`;

  const ntfyServer = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

  const host = (await headers()).get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const icalUrl = row.ical_token
    ? `${proto}://${host}/api/ical/${row.ical_token}`
    : null;

  return (
    <>
      <PageHeader
        title="Mein Konto & Sicherheit"
        description="Passwort, Zwei-Faktor-Authentifizierung und Kalender-Abo"
      />

      {erst === "1" && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <p>
            Willkommen! Dein Passwort wurde vom Admin vergeben — bitte lege
            unten zuerst ein eigenes fest.
          </p>
        </div>
      )}

      {zweiFaktorPflicht && !employee.totpEnabled && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <p>
            Für deine Rolle ist Zwei-Faktor-Authentifizierung verpflichtend.
            Bitte richte sie unten ein, um das Dashboard weiter nutzen zu können.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <EmployeeAvatar
              name={employee.name}
              color={employee.avatarColor}
              imageUrl={employee.avatarUrl}
              size="lg"
            />
            <div>
              <p className="font-display text-base font-semibold">{employee.name}</p>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
            </div>
            <div className="ml-auto text-right text-xs text-muted-foreground">
              <p>Rolle: <span className="font-medium text-foreground">{employee.roleName}</span></p>
              <p className="mt-0.5">Letzter Login: {formatDateTime(row.last_login_at as string)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold">Profil</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Profilbild und Kontaktdaten — sichtbar für dein Team im Dashboard.
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <AvatarUpload
              name={employee.name}
              color={employee.avatarColor}
              imageUrl={employee.avatarUrl}
              sourceUrl={(row.avatar_source_url as string | null) ?? null}
              crop={(row.avatar_crop as { zoom: number; fx: number; fy: number } | null) ?? null}
              storageAktiv={avatarStorageAktiv()}
            />
            <ProfileForm
              defaults={{
                name: employee.name,
                firstName: (row.first_name as string | null) ?? "",
                lastName: (row.last_name as string | null) ?? "",
                phone: (row.phone as string | null) ?? "",
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">Benutzername</h2>
          <div className="mt-4">
            <UsernameForm current={(row.username as string | null) ?? ""} />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">Passwort ändern</h2>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-display text-sm font-semibold">
            Zwei-Faktor-Authentifizierung (2FA)
          </h2>
          <div className="mt-4">
            <TotpSetup enabled={employee.totpEnabled} />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Smartphone className="size-4 text-primary" />
            Handy-Benachrichtigungen
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Push-Nachrichten aufs Handy über die kostenlose ntfy-App.
          </p>
          <div className="mt-4">
            <NtfySection
              topic={(row.ntfy_topic as string | null) ?? null}
              server={ntfyServer}
              prefs={(row.ntfy_prefs as Record<string, boolean> | null) ?? null}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold">Kalender-Abo (iCal)</h2>
          <div className="mt-4">
            <IcalSection currentUrl={icalUrl} />
          </div>
        </section>
      </div>
    </>
  );
}
