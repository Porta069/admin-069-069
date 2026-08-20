"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  // Controlled, damit E-Mail/Passwort über den 2. Schritt (2FA) erhalten
  // bleiben — React 19 leert ein <form> sonst nach jedem Action-Submit.
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-sidebar p-6">
      {/* subtle blueprint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-lg">
            <img
              src="/porta-werk-logo.jpg"
              alt="Porta Werk"
              className="h-6 w-auto"
              draggable={false}
            />
          </span>
          <p className="text-xs text-sidebar-foreground">Internes Betriebssystem</p>
        </div>

        <div className="rounded-xl border border-sidebar-border bg-card p-6 shadow-2xl">
          <h1 className="font-display text-lg font-semibold">Anmelden</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Zugang nur für Porta-Werk-Mitarbeiter.
          </p>

          <form action={formAction} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus={!state?.needsTotp && !state?.needsTotpSetup}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@porta-werk.de"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {state?.needsTotpSetup && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">
                  Zwei-Faktor-Authentifizierung einrichten
                </p>
                <p className="text-xs text-muted-foreground">
                  Für dein Konto ist 2FA erforderlich. Scanne den Code mit einer
                  Authenticator-App (Google Authenticator, Authy, 1Password …) und
                  gib dann den 6-stelligen Code ein.
                </p>
                {state.qrDataUrl && (
                  <div className="flex flex-wrap items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.qrDataUrl}
                      alt="QR-Code für Authenticator-App"
                      className="size-32 rounded-md border bg-white p-1"
                    />
                    {state.totpSecret && (
                      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                        Oder Schlüssel manuell eingeben:{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono break-all">
                          {state.totpSecret}
                        </code>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(state?.needsTotp || state?.needsTotpSetup) && (
              <div className="space-y-1.5">
                <Label htmlFor="totp">2FA-Code</Label>
                <Input
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-stelliger Code"
                  maxLength={6}
                  autoFocus
                  required
                  className="font-mono tracking-widest"
                />
                {!state?.needsTotpSetup && (
                  <p className="text-xs text-muted-foreground">
                    Code aus deiner Authenticator-App eingeben.
                  </p>
                )}
              </div>
            )}

            {state?.error && (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {state?.needsTotpSetup
                ? "Aktivieren & anmelden"
                : state?.needsTotp
                  ? "Bestätigen"
                  : "Anmelden"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-sidebar-foreground/60">
          Jeder Zugriff wird protokolliert.
        </p>
      </div>
    </div>
  );
}
