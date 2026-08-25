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
  KeyRound,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
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
  ShieldAlert,
  Sparkles,
  StickyNote,
  Target,
  UserPlus,
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
      { href: "/cockpit", label: "Mein Cockpit", icon: LayoutGrid, module: null },
      { href: "/hilfe", label: "Hilfe", icon: HelpCircle, module: null },
    ],
  },
  {
    label: "Kandidaten",
    items: [
      { href: "/kandidaten", label: "Kandidaten", icon: UserSquare2, module: "candidates" },
      { href: "/kandidaten-suche", label: "Kandidaten-Suche", icon: UserSearch, module: "matching" },
      { href: "/bewerbungen", label: "Bewerbungen", icon: FileText, module: "applications" },
      { href: "/callcenter", label: "Call Center", icon: Headphones, module: "candidates" },
      { href: "/reaktivierung", label: "Reaktivierung", icon: RefreshCw, module: "candidates" },
    ],
  },
  {
    label: "Unternehmen & Stellen",
    items: [
      { href: "/unternehmen", label: "Unternehmen", icon: Building2, module: "companies" },
      { href: "/anwerbung", label: "Unternehmens-Anwerbung", icon: Target, module: "companies" },
      { href: "/stellen", label: "Stellenanzeigen", icon: Briefcase, module: "jobs" },
    ],
  },
  {
    label: "Matching & Vermittlung",
    items: [
      { href: "/matching", label: "Matching-Center", icon: Sparkles, module: "matching" },
      { href: "/radar", label: "Matching-Radar", icon: Radar, module: "matching" },
      { href: "/vorschlaege", label: "Vorschläge & Angebote", icon: Send, module: "placements" },
      { href: "/vermittlungen", label: "Vermittlungen", icon: Handshake, module: "placements" },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      { href: "/kommunikation", label: "Kommunikation", icon: Mail, module: "communication" },
      { href: "/kampagnen", label: "Kampagnen", icon: Megaphone, module: "communication" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, module: "communication" },
      { href: "/belege", label: "Belege & Schreiben", icon: FileSignature, module: "communication" },
      { href: "/vorlagen", label: "Vorlagen", icon: MessageSquareText, module: "templates" },
      { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell, module: "notifications" },
      { href: "/notizen", label: "Notizen", icon: StickyNote, module: "notes" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { href: "/assistent", label: "KI-Assistent", icon: Bot, module: null },
      { href: "/aufgaben", label: "Aufgaben", icon: ListTodo, module: "tasks" },
      { href: "/kalender", label: "Termine", icon: CalendarDays, module: "calendar" },
      { href: "/dokumente", label: "Dokumente", icon: Files, module: "documents" },
      { href: "/karte", label: "Kartenansicht", icon: Map, module: "map" },
      { href: "/automatisierungen", label: "Automatisierungen", icon: Workflow, module: "automations" },
    ],
  },
  {
    label: "Werbung",
    items: [
      { href: "/werbung", label: "Übersicht", icon: Megaphone, module: "communication" },
      { href: "/werbung/kampagnen", label: "Kampagnen", icon: Target, module: "communication" },
      { href: "/werbung/creatives", label: "Creatives", icon: Files, module: "communication" },
      { href: "/werbung/analytics", label: "Werbe-Analytics", icon: BarChart3, module: "communication" },
      { href: "/werbung/verbindungen", label: "Verbindungen", icon: GitBranch, module: "communication" },
      { href: "/werbung/einstellungen", label: "Einstellungen", icon: Settings, module: "communication" },
    ],
  },
  {
    label: "Finanzen & Partner",
    items: [
      { href: "/finanzen", label: "Finanzen & Rechnungen", icon: Receipt, module: "rewards" },
      { href: "/affiliate", label: "Affiliate / Partner", icon: GitBranch, module: "affiliates" },
      { href: "/praemien", label: "Prämien", icon: Wallet, module: "rewards" },
    ],
  },
  {
    label: "Auswertung",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { href: "/datenqualitaet", label: "Datenqualität", icon: ShieldCheck, module: "candidates" },
    ],
  },
  {
    label: "Mitarbeiter",
    items: [
      { href: "/mitarbeiter", label: "Übersicht", icon: Users, module: "employees" },
      { href: "/mitarbeiter/neu", label: "Mitarbeiter hinzufügen", icon: UserPlus, module: "employees" },
      { href: "/rollen", label: "Rollen & Templates", icon: Lock, module: "roles" },
      { href: "/mitarbeiter/berechtigungen", label: "Berechtigungen", icon: KeyRound, module: "employees" },
      { href: "/audit", label: "Aktivitäten / Protokoll", icon: Shield, module: "audit" },
      { href: "/mitarbeiter/einstellungen", label: "Einstellungen", icon: ShieldCheck, module: "employees" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/status", label: "Systemstatus", icon: Activity, module: null },
      { href: "/firewall", label: "Firewall", icon: ShieldAlert, module: "settings" },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings, module: "settings" },
    ],
  },
];
