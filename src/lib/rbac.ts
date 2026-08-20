import {
  hasPermission,
  type PermissionAction,
  type PermissionMap,
  type PermissionModule,
} from "./permissions";

/**
 * Gemeinsames RBAC-Vokabular und Hilfsfunktionen für Templates, individuelle
 * Berechtigungen und Privilege-Escalation-Schutz. Isomorph (kein server-only,
 * kein DB-Zugriff) — dieselben Labels/Regeln in Server-Actions und Matrix-UI.
 */

export const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  candidates: "Bewerber / Kandidaten",
  companies: "Unternehmen",
  jobs: "Stellenanzeigen",
  applications: "Bewerbungen",
  matching: "Matching-Center",
  placements: "Vermittlungen",
  tasks: "Aufgaben",
  calendar: "Termine",
  communication: "Kommunikation",
  notes: "Notizen",
  documents: "Dokumente",
  map: "Kartenansicht",
  analytics: "Analytics",
  automations: "Automatisierungen",
  templates: "Vorlagen",
  notifications: "Benachrichtigungen",
  employees: "Mitarbeiter",
  roles: "Rollen & Templates",
  affiliates: "Affiliate / Partner",
  rewards: "Finanzen & Prämien",
  audit: "Audit & Sicherheit",
  settings: "System & Einstellungen",
};

/** Reihenfolge der Module in der Matrix (fachlich gruppiert). */
export const RBAC_MODULES: PermissionModule[] = [
  "dashboard", "candidates", "applications", "jobs", "companies",
  "matching", "placements", "communication", "notifications", "templates",
  "tasks", "calendar", "notes", "documents", "map",
  "analytics", "automations", "affiliates", "rewards",
  "employees", "roles", "audit", "settings",
];

export const RBAC_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "Ansehen" },
  { key: "create", label: "Erstellen" },
  { key: "edit", label: "Bearbeiten" },
  { key: "delete", label: "Löschen" },
  { key: "assign", label: "Zuweisen" },
  { key: "export", label: "Export" },
  { key: "override", label: "Override" },
  { key: "manage", label: "Verwalten" },
];

/** Uneingeschränkter Zugriff (Master „*":["*"]). */
export function isFullAccess(permissions: PermissionMap | null | undefined): boolean {
  const all = permissions?.["*"];
  return Boolean(all && all.includes("*"));
}

/** Anzahl konkret vergebener Modul×Aktion-Rechte (Master = alle). */
export function countPermissions(permissions: PermissionMap | null | undefined): number {
  if (!permissions) return 0;
  if (isFullAccess(permissions)) return RBAC_MODULES.length * RBAC_ACTIONS.length;
  let n = 0;
  for (const [mod, actions] of Object.entries(permissions)) {
    if (mod === "*") continue;
    if (!Array.isArray(actions)) continue;
    n += actions.includes("*") ? RBAC_ACTIONS.length : actions.length;
  }
  return n;
}

/**
 * Prüft, ob `sub` vollständig innerhalb von `sup` liegt — d. h. ob jemand mit
 * den Rechten `sup` die Rechte `sub` überhaupt vergeben darf (Escalation-Schutz:
 * man kann nur Rechte weitergeben, die man selbst besitzt). Master (`*`) darf alles.
 */
export function permissionsSubsetOf(sub: PermissionMap, sup: PermissionMap): boolean {
  if (isFullAccess(sup)) return true;
  for (const [mod, actions] of Object.entries(sub)) {
    if (!Array.isArray(actions)) continue;
    if (mod === "*") {
      // „*"-Modul im Subset ist nur zulässig, wenn sup selbst Vollzugriff hat.
      return false;
    }
    for (const action of actions) {
      if (action === "*") return false; // Wildcard nur für Master.
      if (!hasPermission(sup, mod as PermissionModule, action as PermissionAction)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Baut aus einer Matrix-Auswahl {modul: Set<aktion>} eine saubere PermissionMap.
 * Leere Module werden weggelassen; Aktionen auf die bekannten begrenzt.
 */
export function buildPermissionMap(
  selection: Record<string, string[]>,
): PermissionMap {
  const validActions = new Set(RBAC_ACTIONS.map((a) => a.key));
  const out: PermissionMap = {};
  for (const mod of RBAC_MODULES) {
    const actions = (selection[mod] ?? []).filter((a) => validActions.has(a as PermissionAction));
    if (actions.length > 0) out[mod] = actions;
  }
  return out;
}

/** Schneidet eine PermissionMap auf die Obergrenze `sup` zu (nie mehr als der Vergeber). */
export function clampToActor(perms: PermissionMap, sup: PermissionMap): PermissionMap {
  if (isFullAccess(sup)) return perms;
  const out: PermissionMap = {};
  for (const [mod, actions] of Object.entries(perms)) {
    if (mod === "*" || !Array.isArray(actions)) continue;
    const erlaubt = actions.filter(
      (a) => a !== "*" && hasPermission(sup, mod as PermissionModule, a as PermissionAction),
    );
    if (erlaubt.length > 0) out[mod] = erlaubt;
  }
  return out;
}

export function levelLabel(level: number): string {
  if (level >= 100) return "Master";
  if (level >= 80) return "Manager";
  if (level >= 60) return "Teamleiter";
  return "Mitarbeiter";
}

/** Editierbare Matrix-Auswahl {modul: [aktion]}. */
export type Selection = Record<string, string[]>;

/** PermissionMap → Auswahl (Wildcards zu vollständiger Aktionsliste expandiert). */
export function mapToSelection(map: PermissionMap | null | undefined): Selection {
  const sel: Selection = {};
  if (!map) return sel;
  const alle = RBAC_ACTIONS.map((a) => a.key);
  if (isFullAccess(map)) {
    for (const mod of RBAC_MODULES) sel[mod] = [...alle];
    return sel;
  }
  for (const mod of RBAC_MODULES) {
    const actions = map[mod];
    if (Array.isArray(actions) && actions.length) {
      sel[mod] = actions.includes("*") ? [...alle] : [...actions];
    }
  }
  return sel;
}
