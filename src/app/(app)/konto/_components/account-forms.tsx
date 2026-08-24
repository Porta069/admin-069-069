"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  rotateIcalTokenAction,
  startTotpSetupAction,
} from "../actions";
import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const neu = String(data.get("neu"));
        if (neu !== String(data.get("wiederholung"))) {
          toast.error("Die neuen Passwörter stimmen nicht überein.");
          return;
        }
        setPending(true);
        const result = await changePasswordAction(
          String(data.get("aktuell")),
          neu,
        );
        setPending(false);
        if (result.ok) {
          toast.success("Passwort geändert — andere Sitzungen wurden beendet.");
          form.reset();
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="aktuell">Aktuelles Passwort</Label>
        <Input id="aktuell" name="aktuell" type="password" required autoComplete="current-password" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="neu">Neues Passwort</Label>
          <Input id="neu" name="neu" type="password" required minLength={10} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wiederholung">Wiederholen</Label>
          <Input id="wiederholung" name="wiederholung" type="password" required minLength={10} autoComplete="new-password" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mindestens 10 Zeichen. Nach der Änderung bleiben nur diese Sitzung aktiv.
      </p>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Passwort ändern
      </Button>
    </form>
  );
}

export function TotpSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = React.useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [code, setCode] = React.useState("");

  if (enabled) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-success">
          <ShieldCheck className="size-4" /> Zwei-Faktor-Authentifizierung ist aktiv.
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const result = await disableTotpAction(code);
            setPending(false);
            if (result.ok) {
              toast.success("2FA deaktiviert.");
              setCode("");
              router.refresh();
            } else toast.error(result.message);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="disable-code">Code zum Deaktivieren</Label>
            <Input
              id="disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              required
              className="w-40 font-mono tracking-widest"
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
            Deaktivieren
          </Button>
        </form>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Schütze dein Konto zusätzlich mit einem Einmal-Code aus einer
          Authenticator-App (Google Authenticator, Authy, 1Password …).
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await startTotpSetupAction();
            setPending(false);
            if (result.ok) setSetup({ qrDataUrl: result.qrDataUrl, secret: result.secret });
            else toast.error(result.message);
          }}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          2FA einrichten
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={setup.qrDataUrl}
          alt="QR-Code für Authenticator-App"
          className="size-40 rounded-md border bg-white p-1.5"
        />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p>1. QR-Code mit der Authenticator-App scannen.</p>
          <p className="text-muted-foreground">
            Oder Schlüssel manuell eingeben:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
              {setup.secret}
            </code>
          </p>
          <p>2. Den angezeigten 6-stelligen Code bestätigen:</p>
          <form
            className="flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const result = await confirmTotpAction(code);
              setPending(false);
              if (result.ok) {
                toast.success("2FA ist jetzt aktiv.");
                setSetup(null);
                setCode("");
                router.refresh();
              } else toast.error(result.message);
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              required
              aria-label="2FA-Code"
              className="w-36 font-mono tracking-widest"
            />
            <Button type="submit" disabled={pending || code.length < 6}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Aktivieren
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function IcalSection({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Abonniere deine Werkpair-Termine in Apple/Google/Outlook-Kalender über
        einen privaten iCal-Link.
      </p>
      {currentUrl && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 font-mono text-xs">
            {currentUrl}
          </code>
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Link kopieren"
            onClick={async () => {
              await navigator.clipboard.writeText(currentUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
        </div>
      )}
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await rotateIcalTokenAction();
          setPending(false);
          if (result.ok) {
            toast.success(currentUrl ? "Neuer Link erzeugt — der alte ist ungültig." : "Kalender-Link erzeugt.");
            router.refresh();
          } else toast.error(result.message);
        }}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {currentUrl ? "Link erneuern" : "Kalender-Link erzeugen"}
      </Button>
    </div>
  );
}
