import type { PermissionModule } from "@/lib/permissions";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  Files,
  GitBranch,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  Map,
  MessageSquareText,
  Settings,
  Shield,
  Sparkles,
  StickyNote,
  Users,
  UserSquare2,
  Wallet,
  Workflow,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: PermissionModule | null; // null → always visible
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, module: null },
    ],
  },
  {
    label: "Recruiting",
    items: [
      { href: "/kandidaten", label: "Kandidaten", icon: UserSquare2, module: "candidates" },
      { href: "/unternehmen", label: "Unternehmen", icon: Building2, module: "companies" },
      { href: "/stellen", label: "Stellenanzeigen", icon: Briefcase, module: "jobs" },
      { href: "/bewerbungen", label: "Bewerbungen", icon: FileText, module: "applications" },
      { href: "/matching", label: "Matching-Center", icon: Sparkles, module: "matching" },
      { href: "/vermittlungen", label: "Vermittlungen", icon: Handshake, module: "placements" },
    ],
  },
  {
    label: "Arbeit",
    items: [
      { href: "/aufgaben", label: "Aufgaben", icon: ListTodo, module: "tasks" },
      { href: "/kalender", label: "Termine", icon: CalendarDays, module: "calendar" },
      { href: "/kommunikation", label: "Kommunikation", icon: Mail, module: "communication" },
      { href: "/notizen", label: "Notizen", icon: StickyNote, module: "notes" },
      { href: "/dokumente", label: "Dokumente", icon: Files, module: "documents" },
      { href: "/karte", label: "Kartenansicht", icon: Map, module: "map" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { href: "/automatisierungen", label: "Automatisierungen", icon: Workflow, module: "automations" },
      { href: "/vorlagen", label: "Vorlagen", icon: MessageSquareText, module: "templates" },
      { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell, module: "notifications" },
    ],
  },
  {
    label: "Partner",
    items: [
      { href: "/affiliate", label: "Affiliate / Partner", icon: GitBranch, module: "affiliates" },
      { href: "/praemien", label: "Prämien", icon: Wallet, module: "rewards" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/mitarbeiter", label: "Mitarbeiter", icon: Users, module: "employees" },
      { href: "/rollen", label: "Rollen & Rechte", icon: Lock, module: "roles" },
      { href: "/audit", label: "Audit & Sicherheit", icon: Shield, module: "audit" },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings, module: "settings" },
    ],
  },
];
