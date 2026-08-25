"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PUSH_GRUPPEN,
  normalisierePrefs,
  type NtfyPrefs,
} from "@/lib/ntfy-groups";
import {
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  rotateIcalTokenAction,
  startTotpSetupAction,
  enableNtfyAction,
  disableNtfyAction,
  sendeNtfyTestAction,
  saveNtfyPrefsAction,
  updateUsernameAction,
} from "../actions";
import {
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Send,
  BellRing,
} from "lucide-react";

export function UsernameForm({ current }: { current: string }) {
  const router = useRouter();
  const [username, setUsername] = React.useState(current);
  const [pending, setPending] = React.useState(false);
  const dirty = username.trim() !== current;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const res = await updateUsernameAction({ username });
        setPending(false);
        if (res.ok) {
          toast.success("Benutzername geändert.");
          router.refresh();
        } else toast.error(res.message);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="username">Benutzername</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="benutzername"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          3–40 Zeichen: Buchstaben, Ziffern sowie . _ - · Der Login erfolgt über
          deine E-Mail, nicht den Benutzernamen.
        </p>
      </div>
      <Button type="submit" disabled={pending || !dirty || username.trim().length < 3}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Benutzername speichern
      </Button>
    </form>
  );
}

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
        // Führende/abschließende Leerzeichen ignorieren (wie beim Login).
        const neu = String(data.get("neu")).trim();
        if (neu !== String(data.get("wiederholung")).trim()) {
          toast.error("Die neuen Passwörter stimmen nicht überein.");
          return;
        }
        setPending(true);
        const result = await changePasswordAction(
          String(data.get("aktuell")).trim(),
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

function CopyRow({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`${label} kopieren`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

/**
 * Handy-Benachrichtigungen per ntfy: aktivieren erzeugt einen geheimen Topic,
 * den die kostenlose ntfy-App abonniert. Enthält die Schritt-für-Schritt-
 * Anleitung direkt in der Karte.
 */
export function NtfySection({
  topic,
  server,
  prefs,
}: {
  topic: string | null;
  server: string;
  prefs: NtfyPrefs;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const subscribeUrl = topic ? `${server}/${topic}` : "";

  if (!topic) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Erhalte Benachrichtigungen (neue Registrierungen, Chat-Nachrichten,
          Zuweisungen …) direkt auf dein Handy — über die kostenlose{" "}
          <span className="font-medium text-foreground">ntfy</span>-App. Kein
          Account nötig.
        </p>
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const res = await enableNtfyAction();
            setPending(false);
            if (res.ok) {
              toast.success("Aktiviert — jetzt die App verbinden (Schritte unten).");
              router.refresh();
            } else toast.error(res.message);
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          Handy-Benachrichtigungen aktivieren
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
        <Smartphone className="size-4 shrink-0" />
        <span>Aktiv — folge den Schritten, um dein Handy zu verbinden.</span>
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex gap-2.5">
          <Step n={1} />
          <div className="min-w-0">
            <p className="font-medium">ntfy-App installieren</p>
            <p className="text-xs text-muted-foreground">
              iPhone: App Store · Android: Google Play oder F-Droid — jeweils
              „ntfy" suchen und installieren (Entwickler: „Philipp Heckel").
            </p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <Step n={2} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">In der App „+ Subscribe to topic" tippen</p>
            <p className="text-xs text-muted-foreground">
              Diesen Topic-Namen exakt eintragen (Server{" "}
              <span className="font-mono">{server.replace(/^https?:\/\//, "")}</span>{" "}
              ist voreingestellt):
            </p>
            <CopyRow value={topic} label="Topic-Name" />
            <p className="text-xs text-muted-foreground">
              Alternativ am Handy diesen Link öffnen — er abonniert direkt:
            </p>
            <CopyRow value={subscribeUrl} label="Direkt-Link" />
          </div>
        </li>
        <li className="flex gap-2.5">
          <Step n={3} />
          <div className="min-w-0">
            <p className="font-medium">Benachrichtigungen erlauben</p>
            <p className="text-xs text-muted-foreground">
              Beim ersten Mal fragt das Handy nach der Erlaubnis für Push-
              Benachrichtigungen — auf „Erlauben" tippen.
            </p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <Step n={4} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Test senden</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Sollte innerhalb weniger Sekunden auf dem Handy erscheinen.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                const res = await sendeNtfyTestAction();
                setTesting(false);
                if (res.ok) toast.success("Test gesendet — schau auf dein Handy 📱");
                else toast.error(res.message);
              }}
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Test-Push senden
            </Button>
          </div>
        </li>
      </ol>

      <NtfyPrefsList prefs={prefs} />

      <div className="flex items-center gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Halte den Topic-Namen geheim — wer ihn kennt, kann deine
          Benachrichtigungen mitlesen.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const res = await disableNtfyAction();
            setPending(false);
            if (res.ok) {
              toast.success("Handy-Benachrichtigungen deaktiviert.");
              router.refresh();
            } else toast.error(res.message);
          }}
        >
          Deaktivieren
        </Button>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {n}
    </span>
  );
}

/** Checkliste: welche Benachrichtigungs-Gruppen aufs Handy sollen. */
function NtfyPrefsList({ prefs }: { prefs: NtfyPrefs }) {
  const [state, setState] = React.useState<Record<string, boolean>>(() =>
    normalisierePrefs(prefs),
  );
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const toggle = (key: string, value: boolean) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const alle = (value: boolean) => {
    setState(Object.fromEntries(PUSH_GRUPPEN.map((g) => [g.key, value])));
    setDirty(true);
  };
  const aktiveAnzahl = PUSH_GRUPPEN.filter((g) => state[g.key]).length;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BellRing className="size-4 text-primary" />
            Welche Benachrichtigungen aufs Handy?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {aktiveAnzahl} von {PUSH_GRUPPEN.length} aktiv
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => alle(true)}
            className="rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10"
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => alle(false)}
            className="rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted"
          >
            Keine
          </button>
        </div>
      </div>

      <ul className="mt-3 divide-y">
        {PUSH_GRUPPEN.map((g) => (
          <li key={g.key} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{g.label}</p>
              <p className="text-xs text-muted-foreground">{g.description}</p>
            </div>
            <Switch
              checked={state[g.key]}
              onCheckedChange={(v) => toggle(g.key, v)}
              aria-label={g.label}
            />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-end">
        <Button
          size="sm"
          disabled={saving || !dirty}
          onClick={async () => {
            setSaving(true);
            const res = await saveNtfyPrefsAction(state);
            setSaving(false);
            if (res.ok) {
              setDirty(false);
              toast.success("Einstellungen gespeichert.");
            } else toast.error(res.message);
          }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {dirty ? "Speichern" : "Gespeichert"}
        </Button>
      </div>
    </div>
  );
}
