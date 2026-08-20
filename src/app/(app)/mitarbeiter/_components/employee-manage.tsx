"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CircleCheck, KeyRound, Loader2, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  changeEmployeeRole, setEmployeeStatus, resetEmployeePassword, deleteEmployee,
} from "../actions";
import { PasswordReveal } from "./password-reveal";

interface RoleOption { id: string; name: string }

export function EmployeeManage({
  employeeId, name, status, roleId, roles, canEdit, canDelete,
}: {
  employeeId: string;
  name: string;
  status: string;
  roleId: string;
  roles: RoleOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [role, setRole] = React.useState(roleId);
  const [resetPw, setResetPw] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) { toast.success(ok); router.refresh(); }
      else toast.error(r.message ?? "Fehlgeschlagen.");
    });

  if (!canEdit && !canDelete) return null;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-display text-sm font-semibold">Verwalten</h2>

      {canEdit && roles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template / Rolle</p>
          <div className="flex gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={pending || role === roleId}
              onClick={() => run(() => changeEmployeeRole(employeeId, role), "Rolle geändert.")}>
              Ändern
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Ein Rollenwechsel setzt individuelle Rechte zurück.</p>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {status !== "ACTIVE" && (
            <Button variant="outline" size="sm" disabled={pending}
              onClick={() => run(() => setEmployeeStatus(employeeId, "ACTIVE"), "Aktiviert.")}>
              <CircleCheck className="size-4" /> Aktivieren
            </Button>
          )}
          {status === "ACTIVE" && (
            <Button variant="outline" size="sm" disabled={pending}
              onClick={() => run(() => setEmployeeStatus(employeeId, "DISABLED"), "Deaktiviert.")}>
              <Ban className="size-4" /> Deaktivieren
            </Button>
          )}
          {status !== "LOCKED" && (
            <Button variant="outline" size="sm" disabled={pending}
              onClick={() => run(() => setEmployeeStatus(employeeId, "LOCKED"), "Gesperrt.")}>
              <Lock className="size-4" /> Sperren
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={pending}
            onClick={() => startTransition(async () => {
              const r = await resetEmployeePassword(employeeId).catch(() => ({ ok: false as const, message: "Fehlgeschlagen." }));
              if (r.ok && "password" in r) { setResetPw(r.password); router.refresh(); }
              else toast.error((r as { message: string }).message);
            })}>
            <KeyRound className="size-4" /> Passwort zurücksetzen
          </Button>
        </div>
      )}

      {canDelete && (
        <div className="border-t pt-4">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            disabled={pending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" /> Mitarbeiter löschen
          </Button>
        </div>
      )}

      {/* Passwort-Anzeige */}
      <Dialog open={Boolean(resetPw)} onOpenChange={(o) => !o && setResetPw(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neues Passwort für {name}</DialogTitle>
            <DialogDescription>Einmalige Anzeige — sicher übergeben.</DialogDescription>
          </DialogHeader>
          {resetPw && <PasswordReveal password={resetPw} />}
          <DialogFooter><Button onClick={() => setResetPw(null)}>Fertig</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen bestätigen */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mitarbeiter löschen</DialogTitle>
            <DialogDescription>
              {name} wird entfernt und alle Sitzungen beendet. Der Audit-Verlauf bleibt erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            <Button variant="destructive" disabled={pending}
              onClick={() => run(() => deleteEmployee(employeeId), "Gelöscht.")}>
              {pending && <Loader2 className="size-4 animate-spin" />} Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
