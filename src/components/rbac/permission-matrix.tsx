"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasPermission,
  type PermissionMap,
  type PermissionModule,
} from "@/lib/permissions";
import { MODULE_LABELS, RBAC_MODULES, RBAC_ACTIONS, type Selection } from "@/lib/rbac";

export type { Selection };

/**
 * Große, übersichtliche Berechtigungs-Matrix (Modul × Aktion). Zellen, die über
 * die Rechte des Handelnden hinausgehen, sind deaktiviert (Escalation-Schutz
 * auch visuell). `readOnly` zeigt nur an.
 */
export function PermissionMatrix({
  value,
  onChange,
  actorPermissions,
  readOnly = false,
}: {
  value: Selection;
  onChange?: (next: Selection) => void;
  actorPermissions?: PermissionMap;
  readOnly?: boolean;
}) {
  const erlaubt = (mod: PermissionModule, action: string) =>
    !actorPermissions || hasPermission(actorPermissions, mod, action as never);

  const toggle = (mod: string, action: string) => {
    if (readOnly || !onChange) return;
    const current = new Set(value[mod] ?? []);
    if (current.has(action)) current.delete(action);
    else current.add(action);
    // „Ansehen" ist Voraussetzung — beim Setzen anderer Rechte mitsetzen.
    if (action !== "view" && current.has(action)) current.add("view");
    const next = { ...value };
    if (current.size) next[mod] = [...current];
    else delete next[mod];
    onChange(next);
  };

  const toggleRow = (mod: PermissionModule) => {
    if (readOnly || !onChange) return;
    const all = RBAC_ACTIONS.filter((a) => erlaubt(mod, a.key)).map((a) => a.key);
    const current = value[mod] ?? [];
    const next = { ...value };
    if (current.length >= all.length) delete next[mod];
    else next[mod] = all;
    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[680px] text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Modul</th>
            {RBAC_ACTIONS.map((a) => (
              <th key={a.key} className="px-1.5 py-2 text-center font-medium whitespace-nowrap text-muted-foreground">
                {a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RBAC_MODULES.map((mod) => (
            <tr key={mod} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleRow(mod)}
                  className={cn("text-left", !readOnly && "hover:text-primary")}
                >
                  {MODULE_LABELS[mod]}
                </button>
              </td>
              {RBAC_ACTIONS.map((a) => {
                const checked = (value[mod] ?? []).includes(a.key);
                const allowed = erlaubt(mod, a.key);
                if (readOnly) {
                  return (
                    <td key={a.key} className="px-1.5 py-1.5 text-center">
                      {checked ? (
                        <Check className="inline size-3.5 text-success" aria-label="erlaubt" />
                      ) : (
                        <span className="inline-block size-1 rounded-full bg-muted-foreground/25 align-middle" aria-label="nicht erlaubt" />
                      )}
                    </td>
                  );
                }
                return (
                  <td key={a.key} className="px-1.5 py-1.5 text-center">
                    <button
                      type="button"
                      disabled={!allowed}
                      onClick={() => toggle(mod, a.key)}
                      aria-pressed={checked}
                      title={!allowed ? "Du besitzt dieses Recht selbst nicht" : undefined}
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded border transition-colors",
                        checked ? "border-primary bg-primary text-primary-foreground"
                          : allowed ? "border-input hover:border-primary" : "cursor-not-allowed border-dashed opacity-40",
                      )}
                    >
                      {checked && <Check className="size-3.5" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
