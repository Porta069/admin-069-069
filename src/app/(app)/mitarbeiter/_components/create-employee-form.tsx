"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createEmployee } from "../actions";
import { PasswordReveal } from "./password-reveal";

interface RoleOption { id: string; name: string; count: number }

export function CreateEmployeeForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({
    firstName: "", lastName: "", username: "", email: "", phone: "",
    team: "", roleId: roles[0]?.id ?? "", password: "", passwordConfirm: "",
  });
  const [generate, setGenerate] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const [generated, setGenerated] = React.useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const usernameHint = f.username && !/^[a-z0-9][a-z0-9._-]{2,40}$/.test(f.username);

  const submit = () =>
    startTransition(async () => {
      const r = await createEmployee({
        firstName: f.firstName, lastName: f.lastName, username: f.username,
        email: f.email, phone: f.phone, team: f.team, roleId: f.roleId,
        avatarColor: "#e8590c",
        password: f.password, passwordConfirm: f.passwordConfirm,
        generatePassword: generate,
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (r.ok) {
        if (r.generatedPassword) setGenerated(r.generatedPassword);
        else {
          toast.success("Mitarbeiter angelegt.");
          router.push("/mitarbeiter");
        }
      } else toast.error(r.message);
    });

  const valid =
    f.firstName.trim() && f.username.trim() && !usernameHint && f.roleId &&
    (generate || (f.password.length >= 10 && f.password === f.passwordConfirm));

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Persönliche Daten">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vorname" required>
            <Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Max" />
          </Field>
          <Field label="Nachname">
            <Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Mustermann" />
          </Field>
          <Field label="E-Mail (optional)">
            <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="max@porta-jobs.de" />
          </Field>
          <Field label="Telefon (optional)">
            <Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+49 …" />
          </Field>
          <Field label="Team (optional)">
            <Input value={f.team} onChange={(e) => set("team", e.target.value)} placeholder="z. B. Callcenter" />
          </Field>
        </div>
      </Section>

      <Section title="Login">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" required hint={usernameHint ? "Nur Kleinbuchstaben, Zahlen, . _ -, min. 3 Zeichen." : undefined}>
            <Input value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="max.mustermann" />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Sicheres Passwort automatisch generieren (empfohlen)
        </label>
        {!generate && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Passwort" hint="min. 10 Zeichen, Buchstaben + Ziffern">
              <Input type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
            </Field>
            <Field label="Passwort bestätigen" hint={f.passwordConfirm && f.password !== f.passwordConfirm ? "Stimmt nicht überein." : undefined}>
              <Input type="password" value={f.passwordConfirm} onChange={(e) => set("passwordConfirm", e.target.value)} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Rolle / Template">
        <Field label="Template">
          <Select value={f.roleId} onValueChange={(v) => set("roleId", v)}>
            <SelectTrigger><SelectValue placeholder="Template wählen" /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="mt-2 text-xs text-muted-foreground">
          Die Berechtigungen des Templates werden übernommen. Danach lassen sie sich im Mitarbeiterprofil
          individuell anpassen (sofern du dazu berechtigt bist).
        </p>
      </Section>

      <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft/40 p-3 text-sm">
        <ShieldCheck className="size-4 shrink-0 text-info" />
        <span className="text-muted-foreground">
          Jeder Account richtet beim ersten Login selbst seine 2FA (Authenticator-App) ein und muss das Passwort ändern.
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/mitarbeiter")}>Abbrechen</Button>
        <Button onClick={submit} disabled={pending || !valid}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Mitarbeiter anlegen
        </Button>
      </div>

      <Dialog open={Boolean(generated)} onOpenChange={(o) => { if (!o) { setGenerated(null); router.push("/mitarbeiter"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter angelegt — Zugangsdaten</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Username: <span className="font-medium text-foreground">{f.username}</span>. Passwort einmalig anzeigen und sicher übergeben:
          </p>
          {generated && <PasswordReveal password={generated} />}
          <DialogFooter>
            <Button onClick={() => { setGenerated(null); router.push("/mitarbeiter"); }}>Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 font-display text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {hint && <p className="text-xs text-warning">{hint}</p>}
    </div>
  );
}
