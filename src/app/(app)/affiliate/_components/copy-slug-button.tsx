"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Kopiert den Partner-Referral-Link in die Zwischenablage. */
export function CopySlugButton({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 text-muted-foreground"
      aria-label="Referral-Link kopieren"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Link kopiert.");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Kopieren nicht möglich.");
        }
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
