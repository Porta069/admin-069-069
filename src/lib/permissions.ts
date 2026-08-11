/**
 * RBAC vocabulary. Permissions are stored per role as
 * { [module]: [action, ...] } — a "*" module or action grants everything.
 * Enforcement happens exclusively server-side (see auth.ts requireEmployee).
 */

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "assign"
  | "export"
  | "override"
  | "manage";

export type PermissionModule =
  | "dashboard"
  | "candidates"
  | "companies"
  | "jobs"
  | "applications"
  | "matching"
  | "placements"
  | "tasks"
  | "calendar"
  | "communication"
  | "notes"
  | "documents"
  | "map"
  | "analytics"
  | "automations"
  | "templates"
  | "notifications"
  | "employees"
  | "roles"
  | "affiliates"
  | "rewards"
  | "audit"
  | "settings";

export type PermissionMap = Record<string, string[]>;

export function hasPermission(
  permissions: PermissionMap,
  module: PermissionModule,
  action: PermissionAction = "view",
): boolean {
  const all = permissions["*"];
  if (all && (all.includes("*") || all.includes(action))) return true;
  const scoped = permissions[module];
  if (!scoped) return false;
  return scoped.includes("*") || scoped.includes(action);
}

/** Modules every logged-in employee can always see. */
export const ALWAYS_VISIBLE: PermissionModule[] = ["dashboard"];
