import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { sql } from "@/lib/db";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Willkommen bei Werkpair" };

export default async function WillkommenPage() {
  const employee = await requireEmployee();
  // Bereits eingerichtet → direkt ins Dashboard (kein erneutes Onboarding).
  if (employee.onboardedAt) redirect("/");

  const [row] = await sql`
    select totp_enabled, ntfy_topic from admin.employee where id = ${employee.id}`;
  const ntfyServer = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* dezenter Marken-Hintergrund */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[20vh] left-1/2 size-[60vw] max-w-[720px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 18%, transparent), transparent 70%)" }}
      />
      <div className="relative flex w-full flex-col items-center">
        <div className="mb-6 font-display text-lg font-semibold tracking-tight">
          Werk<span className="text-primary">pair</span>
        </div>
        <OnboardingWizard
          name={employee.name}
          twoFactorAktiv={Boolean(row?.totp_enabled)}
          ntfyTopic={(row?.ntfy_topic as string | null) ?? null}
          ntfyServer={ntfyServer}
        />
      </div>
    </main>
  );
}
