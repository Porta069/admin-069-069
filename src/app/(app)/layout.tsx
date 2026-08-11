import Link from "next/link";
import { requireEmployee } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { hasPermission } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { NAV_GROUPS } from "@/components/shell/nav-config";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import {
  NotificationsBell,
  QuickActions,
  UserMenu,
} from "@/components/shell/topbar-menus";
import { Hammer } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const employee = await requireEmployee();

  const allowedHrefs = NAV_GROUPS.flatMap((group) =>
    group.items
      .filter(
        (item) =>
          item.module === null ||
          hasPermission(employee.permissions, item.module, "view"),
      )
      .map((item) => item.href),
  );

  const [{ count: unread }] = await sql`
    select count(*)::int as count from admin.notification
    where employee_id = ${employee.id} and read_at is null`;

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link
          href="/"
          className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4"
        >
          <span className="flex size-7.5 items-center justify-center rounded-md bg-sidebar-primary">
            <Hammer className="size-4 text-white" />
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-white">
            PORTAWERK
            <span className="ml-1.5 rounded bg-sidebar-accent px-1 py-0.5 align-middle text-[9px] font-semibold tracking-wider text-sidebar-foreground">
              ADMIN
            </span>
          </span>
        </Link>
        <SidebarNav allowedHrefs={allowedHrefs} />
        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="text-[11px] text-sidebar-foreground/50">
            Internes Betriebssystem · v1
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/60 px-5 backdrop-blur">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <QuickActions />
            <NotificationsBell initialUnread={unread as number} />
            <UserMenu
              name={employee.name}
              email={employee.email}
              roleName={employee.roleName}
              avatarColor={employee.avatarColor}
              logoutAction={logoutAction}
            />
          </div>
        </header>
        <main className="canvas-texture min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
