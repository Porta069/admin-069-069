"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Loader2, ShieldAlert } from "lucide-react";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

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
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary">
            <Hammer className="size-5 text-white" />
          </span>
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-white">
              PORTAWERK
            </p>
            <p className="text-xs text-sidebar-foreground">
              Internes Betriebssystem
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sidebar-border bg-card p-6 shadow-2xl">
          <h1 className="font-display text-lg font-semibold">Anmelden</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Zugang nur für PORTAWERK-Mitarbeiter.
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
                autoFocus
                placeholder="name@portawerk.de"
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
              />
            </div>

            {state?.needsTotp && (
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
                <p className="text-xs text-muted-foreground">
                  Code aus deiner Authenticator-App eingeben.
                </p>
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
              Anmelden
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
