"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Loader2 } from "lucide-react";
import { deleteFixedCost, getFixedCostInvoiceUrl } from "../actions";

export function BelegButton({ id }: { id: string }) {
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await getFixedCostInvoiceUrl(id);
        setPending(false);
        if (res.ok) window.open(res.url, "_blank", "noopener");
        else toast.error(res.message);
      }}
      className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-medium hover:bg-muted"
      title="Beleg öffnen"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
      Beleg
    </button>
  );
}

export function DeleteFixedCostButton({
  id,
  bezeichnung,
}: {
  id: string;
  bezeichnung: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`„${bezeichnung}" wirklich löschen?`)) return;
        setPending(true);
        const res = await deleteFixedCost(id);
        setPending(false);
        if (res.ok) {
          toast.success("Gelöscht.");
          router.refresh();
        } else toast.error(res.message);
      }}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Löschen"
      title="Löschen"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
