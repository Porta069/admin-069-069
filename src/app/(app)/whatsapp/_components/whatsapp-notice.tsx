import { MessageCircleMore } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Info-Karte (kein Fehler!) — der WhatsApp-Versand ist vorbereitet, aber die
 * WhatsApp Business API ist noch nicht angebunden. Regeln lassen sich bereits
 * anlegen und greifen automatisch, sobald die Integration steht.
 */
export function WhatsappNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-info/25 bg-info-soft px-4 py-3.5",
        className,
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-info/10">
        <MessageCircleMore className="size-4 text-info" aria-hidden />
      </span>
      <div className="text-sm">
        <p className="font-medium text-info">
          WhatsApp-Versand ist vorbereitet, aber noch nicht aktiv
        </p>
        <p className="mt-0.5 text-info/80">
          Die Integration (WhatsApp Business API) folgt. Regeln kannst du schon
          anlegen — sie greifen automatisch, sobald die Anbindung steht.
        </p>
      </div>
    </div>
  );
}
