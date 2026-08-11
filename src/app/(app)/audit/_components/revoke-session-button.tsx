"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { revokeSession } from "../actions";

export function RevokeSessionButton({
  tokenHash,
  employeeName,
}: {
  tokenHash: string;
  employeeName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const revoke = async () => {
    if (pending) return;
    setPending(true);
    const result = await revokeSession(tokenHash);
    setPending(false);
    if (result.ok) {
      toast.success("Sitzung wurde beendet");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 bg-card text-xs"
        onClick={() => setOpen(true)}
      >
        <LogOut className="size-3.5" />
        Beenden
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sitzung beenden</DialogTitle>
            <DialogDescription>
              {employeeName} wird auf diesem Gerät sofort abgemeldet und muss
              sich neu anmelden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" disabled={pending} onClick={revoke}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Sitzung beenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
