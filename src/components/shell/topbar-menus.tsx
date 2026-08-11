"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmployeeAvatar } from "@/components/common/employee-avatar";
import { formatRelative } from "@/lib/format";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarPlus,
  ListPlus,
  LogOut,
  Plus,
  StickyNote,
  UserCog,
  UserPlus,
} from "lucide-react";

export function QuickActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8.5 gap-1.5">
          <Plus className="size-4" />
          Neu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/unternehmen?neu=1">
            <Building2 className="size-4" /> Unternehmen anlegen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/stellen?neu=1">
            <Briefcase className="size-4" /> Job anlegen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/aufgaben?neu=1">
            <ListPlus className="size-4" /> Aufgabe erstellen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/kalender?neu=1">
            <CalendarPlus className="size-4" /> Termin erstellen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notizen?neu=1">
            <StickyNote className="size-4" /> Notiz erstellen
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/mitarbeiter?neu=1">
            <UserPlus className="size-4" /> Mitarbeiter einladen
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  priority: string;
  readAt: string | null;
  createdAt: string;
  href: string | null;
}

export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = React.useState(initialUnread);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: { notifications: NotificationItem[] }) =>
        setItems(d.notifications),
      )
      .catch(() => setItems([]));
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => null);
    setUnread(0);
    setItems((prev) =>
      prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ??
      prev,
    );
    router.refresh();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-8.5 bg-card"
          aria-label="Benachrichtigungen"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-semibold">Benachrichtigungen</p>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-primary hover:underline"
            >
              Alle als gelesen markieren
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Lädt…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Keine Benachrichtigungen
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                className="flex w-full items-start gap-2.5 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60"
                onClick={() => {
                  setOpen(false);
                  if (n.href) router.push(n.href);
                }}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                    {formatRelative(n.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Link
            href="/benachrichtigungen"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            Alle anzeigen →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function UserMenu({
  name,
  email,
  roleName,
  avatarColor,
  logoutAction,
}: {
  name: string;
  email: string;
  roleName: string;
  avatarColor: string;
  logoutAction: () => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <EmployeeAvatar name={name} color={avatarColor} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs font-normal text-muted-foreground">{email}</p>
          <p className="mt-1 inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            {roleName}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/konto">
            <UserCog className="size-4" /> Mein Konto & Sicherheit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void logoutAction()}
        >
          <LogOut className="size-4" /> Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
