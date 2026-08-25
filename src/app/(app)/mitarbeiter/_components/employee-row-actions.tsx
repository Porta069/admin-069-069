"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ban,
  CircleCheck,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  changeEmployeeRole,
  deleteEmployee,
  resetEmployeePassword,
  setEmployeeStatus,
} from "../actions";
import { PasswordReveal } from "./password-reveal";

interface RoleOption {
  id: string;
  name: string;
}

type DialogKind = "role" | "status" | "reset" | "delete" | null;

export function EmployeeRowActions({
  employee,
  roles,
  actorIsSuperadmin,
  canEdit,
  canDelete,
  isSelf,
}: {
  employee: { id: string; name: string; roleId: string; status: string };
  roles: RoleOption[];
  actorIsSuperadmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [pending, setPending] = React.useState(false);
  const [roleId, setRoleId] = React.useState(employee.roleId);
  const [resetPassword, setResetPassword] = React.useState<string | null>(null);

  const isActive = employee.status === "ACTIVE";
  const canChangeRole = canEdit && actorIsSuperadmin;
  const mayDelete = canDelete && actorIsSuperadmin;

  if (isSelf) {
    return (
      <span
        className="text-xs text-muted-foreground/70"
        title="Aktionen auf den eigenen Account sind gesperrt."
      >
        Eigener Account
      </span>
    );
  }

  if (!canEdit && !mayDelete) return null;

  const close = () => {
    setDialog(null);
    setResetPassword(null);
    setRoleId(employee.roleId);
  };

  const run = async (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
    closeAfter = true,
  ) => {
    if (pending) return;
    setPending(true);
    const result = await fn();
    setPending(false);
    if (result.ok) {
      toast.success(successMessage);
      router.refresh();
      if (closeAfter) close();
    } else {
      toast.error(result.message ?? "Aktion fehlgeschlagen.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Aktionen für ${employee.name}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {employee.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canChangeRole && (
            <DropdownMenuItem onSelect={() => setDialog("role")}>
              <UserCog className="size-4" />
              Rolle ändern
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setDialog("status")}>
              {isActive ? (
                <>
                  <Ban className="size-4" />
                  Deaktivieren
                </>
              ) : (
                <>
                  <CircleCheck className="size-4" />
                  Aktivieren
                </>
              )}
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setDialog("reset")}>
              <KeyRound className="size-4" />
              Passwort erzeugen &amp; anzeigen
            </DropdownMenuItem>
          )}
          {mayDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDialog("delete")}
              >
                <Trash2 className="size-4" />
                Löschen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rolle ändern */}
      <Dialog open={dialog === "role"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rolle ändern</DialogTitle>
            <DialogDescription>
              Neue Rolle für {employee.name} festlegen.
            </DialogDescription>
          </DialogHeader>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Rolle wählen" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Abbrechen
            </Button>
            <Button
              disabled={pending || roleId === employee.roleId}
              onClick={() =>
                run(
                  () => changeEmployeeRole(employee.id, roleId),
                  "Rolle wurde geändert",
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aktivieren / Deaktivieren */}
      <Dialog open={dialog === "status"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Mitarbeiter deaktivieren" : "Mitarbeiter aktivieren"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? `${employee.name} kann sich danach nicht mehr anmelden. Alle aktiven Sitzungen werden sofort beendet.`
                : `${employee.name} kann sich danach wieder anmelden.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Abbrechen
            </Button>
            <Button
              variant={isActive ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    setEmployeeStatus(
                      employee.id,
                      isActive ? "DISABLED" : "ACTIVE",
                    ),
                  isActive
                    ? "Mitarbeiter wurde deaktiviert"
                    : "Mitarbeiter wurde aktiviert",
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isActive ? "Deaktivieren" : "Aktivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passwort zurücksetzen */}
      <Dialog open={dialog === "reset"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          {resetPassword ? (
            <>
              <DialogHeader>
                <DialogTitle>Neues Passwort</DialogTitle>
                <DialogDescription>
                  Zugangsdaten für {employee.name} — einmalige Anzeige.
                </DialogDescription>
              </DialogHeader>
              <PasswordReveal password={resetPassword} />
              <DialogFooter>
                <Button onClick={close}>Fertig</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Passwort erzeugen &amp; anzeigen</DialogTitle>
                <DialogDescription>
                  Das gespeicherte Passwort lässt sich aus Sicherheitsgründen
                  nicht anzeigen (es ist verschlüsselt). Für {employee.name} wird
                  ein neues sicheres Passwort erzeugt und einmalig angezeigt — das
                  alte Passwort ist danach ungültig.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Abbrechen
                </Button>
                <Button
                  disabled={pending}
                  onClick={async () => {
                    if (pending) return;
                    setPending(true);
                    const result = await resetEmployeePassword(employee.id);
                    setPending(false);
                    if (result.ok) {
                      setResetPassword(result.password);
                      router.refresh();
                    } else {
                      toast.error(result.message);
                    }
                  }}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Erzeugen &amp; anzeigen
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Löschen */}
      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mitarbeiter löschen</DialogTitle>
            <DialogDescription>
              {employee.name} wird entfernt und alle Sitzungen werden beendet.
              Der Audit-Verlauf bleibt erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteEmployee(employee.id),
                  "Mitarbeiter wurde gelöscht",
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
