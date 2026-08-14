"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createReferralInvoice } from "../../finanzen/actions";

/** Erzeugt die Empfehlungsabrechnung (Beleg) zu einem Referral und öffnet sie. */
export function CreateSettlementButton({ referralId }: { referralId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await createReferralInvoice(referralId).catch(() => ({
            ok: false as const,
            message: "Verbindung fehlgeschlagen.",
          }));
          if (res.ok) {
            toast.success(res.message ?? "Beleg erstellt.");
            if ("invoiceId" in res && res.invoiceId) {
              router.push(`/finanzen/${res.invoiceId}`);
            } else {
              router.refresh();
            }
          } else {
            toast.error(res.message);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FileText className="size-3.5" />
      )}
      Beleg
    </Button>
  );
}
