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
export function PasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Passwort in die Zwischenablage kopiert");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Kopieren fehlgeschlagen — bitte manuell markieren.");
    }
  };

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
          onClick={copy}
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
          Kopieren
        </Button>
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Passwort jetzt sicher übermitteln — es wird nicht erneut angezeigt.
      </p>
    </div>
  );
}
