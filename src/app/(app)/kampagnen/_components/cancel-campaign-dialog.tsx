"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import { cancelCampaign } from "../actions";

export function CancelCampaignDialog({
  campaignId,
  campaignName,
  pendingCount,
}: {
  campaignId: string;
  campaignName: string;
  /** Anzahl noch wartender Outbox-Mails — werden übersprungen. */
  pendingCount: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await cancelCampaign(campaignId);
      if (result.ok) {
        toast.success(result.message ?? "Kampagne wurde abgebrochen.");
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ban className="size-4" />
          Abbrechen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kampagne abbrechen?</DialogTitle>
          <DialogDescription>
            „{campaignName}“ wird auf „Abgebrochen“ gesetzt.{" "}
            {pendingCount > 0
              ? `${formatNumber(pendingCount)} wartende E-Mail${pendingCount === 1 ? "" : "s"} in der Outbox ${pendingCount === 1 ? "wird" : "werden"} übersprungen und nicht mehr versendet.`
              : "Es warten keine E-Mails mehr in der Outbox."}{" "}
            Bereits versendete Mails sind davon nicht betroffen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Zurück
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "Bricht ab…" : "Kampagne abbrechen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
