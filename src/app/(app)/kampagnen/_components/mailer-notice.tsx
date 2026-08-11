import { PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Info-Karte (kein Fehler!), solange kein E-Mail-Provider verbunden ist.
 * Kampagnen funktionieren trotzdem — Mails sammeln sich in der Outbox.
 */
export function MailerNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-info/25 bg-info-soft px-4 py-3.5",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-info/10">
        <PlugZap className="size-4 text-info" aria-hidden />
      </span>
      <div className="text-sm">
        <p className="font-medium text-info">
          E-Mail-Provider noch nicht verbunden
        </p>
        <p className="mt-0.5 text-info/80">
          Kampagnen werden vorbereitet und in der Outbox gesammelt. Sobald ein
          Provider-Key (RESEND_API_KEY + EMAIL_FROM) in Vercel hinterlegt ist,
          versendet das System automatisch.
        </p>
      </div>
    </div>
  );
}
