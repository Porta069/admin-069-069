import Link from "next/link";
import { after } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { hasPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { runSyncThrottled } from "@/lib/sync";
import { NAV_GROUPS } from "@/components/shell/nav-config";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { PresenceHeartbeat } from "@/components/shell/presence-heartbeat";
import { PresenceSwitcher } from "@/components/shell/presence-switcher";
import { TempLock } from "@/components/shell/temp-lock";
import { effektivePraesenz } from "@/lib/presence";
import { SidebarLogo, SplashProvider } from "@/components/shell/logo-splash";
import {
  NotificationsBell,
  QuickActions,
  UserMenu,
} from "@/components/shell/topbar-menus";
import { KeyRound } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const employee = await requireEmployee();

  // Event-Sync & Automationen nach der Antwort anstoßen (throttled, alle 5 Min.)
  after(() => runSyncThrottled());

  const allowedHrefs = NAV_GROUPS.flatMap((group) =>
    group.items
      .filter(
        (item) =>
          item.module === null ||
          hasPermission(employee.permissions, item.module, "view"),
      )
      .map((item) => item.href),
  );

  const [[{ count: unread }], [praesenz]] = await Promise.all([
    sql`
      select count(*)::int as count from admin.notification
      where employee_id = ${employee.id} and acknowledged_at is null`,
    sql`select presence, last_seen_at from admin.employee where id = ${employee.id}`,
  ]);
  const presence = (praesenz?.presence as string) ?? "AVAILABLE";
  const effektivePresence = effektivePraesenz(presence, praesenz?.last_seen_at as Date);

  return (
    <div className="flex h-dvh overflow-hidden">
      <PresenceHeartbeat />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarLogo />
        <SidebarNav allowedHrefs={allowedHrefs} />
        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[11px] text-sidebar-foreground/50">
            Internes Betriebssystem · v1
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/60 px-4 backdrop-blur sm:px-5">
          <MobileNav allowedHrefs={allowedHrefs} />
          <GlobalSearch allowedHrefs={allowedHrefs} />
          <div className="ml-auto flex items-center gap-2">
            <TempLock userName={employee.name} />
            <PresenceSwitcher
              initialPresence={presence}
              initialEffektiv={effektivePresence}
            />
            <QuickActions />
            <NotificationsBell initialUnread={unread as number} />
            <UserMenu
              name={employee.name}
              email={employee.email}
              roleName={employee.roleName}
              avatarColor={employee.avatarColor}
              avatarUrl={employee.avatarUrl}
              logoutAction={logoutAction}
            />
          </div>
        </header>
        {employee.mustChangePassword && (
          <div className="flex items-center gap-2.5 border-b bg-warning-soft px-5 py-2 text-sm text-warning">
            <KeyRound className="size-4 shrink-0" />
            <span>
              Dein Passwort wurde vom Admin gesetzt — bitte lege jetzt ein
              eigenes fest.
            </span>
            <Link
              href="/konto"
              className="ml-auto shrink-0 font-medium underline underline-offset-2"
            >
              Passwort ändern →
            </Link>
          </div>
        )}
        <main className="canvas-texture min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
            {children}
          </div>
        </main>
      </div>
      <SplashProvider />
    </div>
  );
}
