import type { PermissionModule } from "@/lib/permissions";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  Files,
  GitBranch,
  Handshake,
  Headphones,
  LayoutDashboard,
  ListTodo,
  Lock,
  Mail,
  Map,
  Megaphone,
  MessageCircle,
  Radar,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  MessageSquareText,
  Settings,
  Shield,
  Sparkles,
  StickyNote,
  Users,
  UserSearch,
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
      { href: "/kandidaten-suche", label: "Kandidaten-Suche", icon: UserSearch, module: "matching" },
      { href: "/radar", label: "Matching-Radar", icon: Radar, module: "matching" },
      { href: "/vorschlaege", label: "Vorschläge & Angebote", icon: Send, module: "placements" },
      { href: "/vermittlungen", label: "Vermittlungen", icon: Handshake, module: "placements" },
    ],
  },
  {
    label: "Arbeit",
    items: [
      { href: "/assistent", label: "KI-Assistent", icon: Bot, module: null },
      { href: "/callcenter", label: "Call Center", icon: Headphones, module: "candidates" },
      { href: "/aufgaben", label: "Aufgaben", icon: ListTodo, module: "tasks" },
      { href: "/kalender", label: "Termine", icon: CalendarDays, module: "calendar" },
      { href: "/kommunikation", label: "Kommunikation", icon: Mail, module: "communication" },
      { href: "/kampagnen", label: "Kampagnen", icon: Megaphone, module: "communication" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, module: "communication" },
      { href: "/notizen", label: "Notizen", icon: StickyNote, module: "notes" },
      { href: "/belege", label: "Belege & Schreiben", icon: FileSignature, module: "communication" },
      { href: "/dokumente", label: "Dokumente", icon: Files, module: "documents" },
      { href: "/karte", label: "Kartenansicht", icon: Map, module: "map" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { href: "/finanzen", label: "Finanzen & Rechnungen", icon: Receipt, module: "rewards" },
      { href: "/datenqualitaet", label: "Datenqualität", icon: ShieldCheck, module: "candidates" },
      { href: "/reaktivierung", label: "Reaktivierung", icon: RefreshCw, module: "candidates" },
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
      { href: "/status", label: "Systemstatus", icon: Activity, module: null },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings, module: "settings" },
    ],
  },
];
