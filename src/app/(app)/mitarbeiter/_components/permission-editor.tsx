"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PermissionMap } from "@/lib/permissions";
import { PermissionMatrix, type Selection } from "@/components/rbac/permission-matrix";
import { updateEmployeePermissions } from "../actions";

export function PermissionEditor({
  employeeId,
  canEdit,
  templateName,
  templateSelection,
  initialMode,
  initialSelection,
  actorPermissions,
}: {
  employeeId: string;
  canEdit: boolean;
  templateName: string;
  templateSelection: Selection;
  initialMode: "template" | "custom";
  initialSelection: Selection;
  actorPermissions: PermissionMap;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"template" | "custom">(initialMode);
  const [selection, setSelection] = React.useState<Selection>(initialSelection);
  const [pending, startTransition] = React.useTransition();

  const shown = mode === "template" ? templateSelection : selection;

  const save = () =>
    startTransition(async () => {
      const r = await (mode === "template"
        ? updateEmployeePermissions(employeeId, "template")
        : updateEmployeePermissions(employeeId, "custom", selection)
      ).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) {
        toast.success("Berechtigungen gespeichert.");
        router.refresh();
      } else toast.error(r.message);
    });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            <TabBtn active={mode === "template"} onClick={() => setMode("template")}>
              Folgt Template
            </TabBtn>
            <TabBtn active={mode === "custom"} onClick={() => {
              setMode("custom");
              // Startpunkt: aktuelle Auswahl (bei erstem Wechsel = Template).
              setSelection((s) => (Object.keys(s).length ? s : templateSelection));
            }}>
              Individuell
            </TabBtn>
          </div>
          <span className="text-xs text-muted-foreground">
            {mode === "template"
              ? `Rechte kommen aus dem Template „${templateName}".`
              : "Individuell angepasst — Änderungen am Template wirken sich nicht mehr aus."}
          </span>
          <Button size="sm" className="ml-auto" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Speichern
          </Button>
        </div>
      )}

      <PermissionMatrix
        value={shown}
        onChange={mode === "custom" && canEdit ? setSelection : undefined}
        actorPermissions={actorPermissions}
        readOnly={mode === "template" || !canEdit}
      />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
