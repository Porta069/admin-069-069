"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createEmployee } from "../actions";
import { PasswordReveal } from "./password-reveal";

export const AVATAR_COLORS = [
  "#e8590c",
  "#0f766e",
  "#1d4ed8",
  "#b45309",
  "#7c3aed",
  "#0e7490",
  "#be185d",
  "#57534e",
] as const;

interface RoleOption {
  id: string;
  name: string;
}

export function CreateEmployeeDialog({
  roles,
  canCreateSuperadmin,
  initialOpen,
}: {
  roles: RoleOption[];
  canCreateSuperadmin: boolean;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(initialOpen);
  const [pending, setPending] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [team, setTeam] = React.useState("");
  const [avatarColor, setAvatarColor] = React.useState<string>(
    AVATAR_COLORS[0],
  );
  const [generate, setGenerate] = React.useState(true);
  const [password, setPassword] = React.useState("");

  const [created, setCreated] = React.useState<{
    name: string;
    generatedPassword: string | null;
  } | null>(null);

  const selectableRoles = roles.filter(
    (r) => canCreateSuperadmin || r.id !== "SUPERADMIN",
  );

  const resetForm = () => {
    setName("");
    setEmail("");
    setRoleId("");
    setTeam("");
    setAvatarColor(AVATAR_COLORS[0]);
    setGenerate(true);
    setPassword("");
    setCreated(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      resetForm();
      // ?neu=1 aus der URL entfernen, damit der Dialog nicht erneut aufspringt.
      router.replace(pathname, { scroll: false });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!roleId) {
      toast.error("Bitte eine Rolle auswählen.");
      return;
    }
    setPending(true);
    const result = await createEmployee({
      name,
      email,
      roleId,
      team,
      avatarColor,
      password,
      generatePassword: generate,
    });
    setPending(false);
    if (result.ok) {
      toast.success("Mitarbeiter wurde angelegt");
      router.refresh();
      if (result.generatedPassword) {
        setCreated({ name, generatedPassword: result.generatedPassword });
      } else {
        handleOpenChange(false);
      }
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Mitarbeiter anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Mitarbeiter angelegt</DialogTitle>
              <DialogDescription>
                Zugangsdaten für {created.name} — einmalige Anzeige.
              </DialogDescription>
            </DialogHeader>
            {created.generatedPassword && (
              <PasswordReveal password={created.generatedPassword} />
            )}
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Fertig</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Mitarbeiter anlegen</DialogTitle>
              <DialogDescription>
                Neuer Zugang für das interne Admin-Dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="emp-name">Name</Label>
              <Input
                id="emp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vor- und Nachname"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-email">E-Mail</Label>
              <Input
                id="emp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@porta-werk.de"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-team">Team (optional)</Label>
                <Input
                  id="emp-team"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="z. B. Vermittlung"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Avatar-Farbe</Label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                      avatarColor === color &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Farbe ${color}`}
                  >
                    {avatarColor === color && (
                      <Check className="size-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={generate}
                  onCheckedChange={(checked) => setGenerate(checked === true)}
                />
                Sicheres Passwort generieren
              </label>
              {generate ? (
                <p className="text-xs text-muted-foreground">
                  Das Passwort wird nach dem Anlegen einmalig angezeigt.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="emp-password">Passwort</Label>
                  <Input
                    id="emp-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    required
                    minLength={8}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Anlegen
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
