"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * One-time display of a freshly generated password.
 * Shown exactly once — the hash is already stored, the plaintext is gone
 * after the dialog closes.
 */
export function PasswordReveal({
  password,
  username,
}: {
  password: string;
  username?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [copiedAll, setCopiedAll] = React.useState(false);

  const copyText = async (
    text: string,
    setFlag: (v: boolean) => void,
    label: string,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      toast.success(label);
      setTimeout(() => setFlag(false), 2500);
    } catch {
      toast.error("Kopieren fehlgeschlagen — bitte manuell markieren.");
    }
  };

  const zugangsdaten = username
    ? `Werkpair Admin — Zugangsdaten\nUsername: ${username}\nPasswort: ${password}`
    : password;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-base font-semibold tracking-wide select-all">
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 bg-card"
          onClick={() => copyText(password, setCopied, "Passwort kopiert")}
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
          Passwort
        </Button>
      </div>

      {username && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() =>
            copyText(zugangsdaten, setCopiedAll, "Zugangsdaten kopiert — bereit zum Übermitteln")
          }
        >
          {copiedAll ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          Zugangsdaten kopieren (Username + Passwort)
        </Button>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Jetzt sicher an den Mitarbeiter übermitteln — es wird nicht erneut angezeigt.
      </p>
    </div>
  );
}
