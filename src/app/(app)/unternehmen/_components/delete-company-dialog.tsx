"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult, CompanyDeletionInfo } from "../actions";

type InfoResult = CompanyDeletionInfo | { ok: false; message: string };

/**
 * Endgültiges Löschen ist derzeit deaktiviert: Betriebe werden ausschließlich
 * über die Backend-Schnittstelle geändert/gelöscht, ein Admin-Endpunkt zum
 * Hard-Delete fehlt noch. Auf `true` stellen, sobald er existiert.
 */
const HARD_DELETE_VERFUEGBAR = false;

/**
 * Unternehmen löschen im 2-Schritt-Verfahren:
 * Schritt 1 — Konsequenzen + Wahl „Archivieren (empfohlen)" / „Endgültig löschen".
 * Schritt 2 — nur bei Endgültig: Firmennamen tippen, erst dann wird der rote
 * Button aktiv. Endgültig ist serverseitig SUPERADMIN-only.
 */
export function DeleteCompanyDialog({
  companyId,
  getInfo,
  archiveAction,
  deleteAction,
  trigger = "button",
  redirectAfterDelete = false,
}: {
  companyId: string;
  getInfo: (id: string) => Promise<InfoResult>;
  archiveAction: (id: string) => Promise<ActionResult>;
  deleteAction: (id: string, confirmName: string) => Promise<ActionResult>;
  /** "button" = destructive Button (Detailseite), "icon" = Zeilen-Aktion. */
  trigger?: "button" | "icon";
  /** Nach endgültigem Löschen zur Liste navigieren (Detailseite). */
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"choice" | "confirm">("choice");
  const [info, setInfo] = React.useState<InfoResult | null>(null);
  const [confirmName, setConfirmName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setStep("choice");
      setConfirmName("");
      setInfo(null);
      getInfo(companyId)
        .then(setInfo)
        .catch(() =>
          setInfo({ ok: false, message: "Verbindung fehlgeschlagen." }),
        );
    }
  };

  const archive = () =>
    startTransition(async () => {
      const result = await archiveAction(companyId).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Unternehmen archiviert.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Archivieren fehlgeschlagen.");
      }
    });

  const hardDelete = () =>
    startTransition(async () => {
      const result = await deleteAction(companyId, confirmName).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Unternehmen gelöscht.");
        setOpen(false);
        if (redirectAfterDelete) router.push("/unternehmen");
        router.refresh();
      } else {
        toast.error(result.message ?? "Löschen fehlgeschlagen.");
      }
    });

  const loaded = info?.ok === true ? info : null;
  const nameMatches =
    loaded != null &&
    confirmName.trim().toLowerCase() === loaded.name.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label="Unternehmen löschen"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <Button variant="destructive" size="sm">
            <Trash2 className="size-4" />
            Unternehmen löschen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "choice" ? (
          <>
            <DialogHeader>
              <DialogTitle>Unternehmen löschen?</DialogTitle>
              <DialogDescription>
                {loaded
                  ? `Das betrifft „${loaded.name}" und alle Verknüpfungen.`
                  : "Konsequenzen werden geladen…"}
              </DialogDescription>
            </DialogHeader>

            {info == null ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !info.ok ? (
              <p className="py-4 text-sm text-destructive">{info.message}</p>
            ) : (
              <>
                <div className="rounded-md border bg-muted/40 p-3.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Konsequenzen
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex justify-between gap-4">
                      <span>Stellenanzeigen</span>
                      <span className="font-medium tabular">{info.jobs}</span>
                    </li>
                    <li className="flex justify-between gap-4">
                      <span>Bewerbungen über diese Jobs</span>
                      <span className="font-medium tabular">
                        {info.applications}
                      </span>
                    </li>
                    <li className="flex justify-between gap-4">
                      <span>Kontaktanfragen</span>
                      <span className="font-medium tabular">
                        {info.contactRequests}
                      </span>
                    </li>
                    {info.offers > 0 && (
                      <li className="flex justify-between gap-4">
                        <span>Angebote an Handwerker</span>
                        <span className="font-medium tabular">{info.offers}</span>
                      </li>
                    )}
                    {info.placements > 0 && (
                      <li className="flex justify-between gap-4">
                        <span>Vermittlungen</span>
                        <span className="font-medium tabular">
                          {info.placements}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={archive}
                    disabled={pending || info.archived}
                    className="flex w-full items-start gap-3 rounded-md border p-3.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Archive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">
                        Archivieren (empfohlen)
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {info.archived
                          ? "Bereits archiviert — nichts zu tun."
                          : "Verschwindet aus der Standardliste, alle Daten bleiben erhalten. Jederzeit wiederherstellbar."}
                      </span>
                    </span>
                    {pending && (
                      <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep("confirm")}
                    disabled={pending || !HARD_DELETE_VERFUEGBAR || !info.canHardDelete}
                    className="flex w-full items-start gap-3 rounded-md border border-destructive/30 p-3.5 text-left transition-colors hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <span>
                      <span className="block text-sm font-medium text-destructive">
                        Endgültig löschen
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {!HARD_DELETE_VERFUEGBAR
                          ? "Derzeit nicht verfügbar — endgültiges Löschen läuft künftig über einen Backend-Endpunkt. Bitte archivieren."
                          : !info.isSuperadmin
                            ? "Nur für Superadmins möglich."
                            : !info.canHardDelete
                              ? "Nicht möglich: verknüpfte Bewerbungen/Vermittlungen vorhanden. Bitte archivieren."
                              : "Unternehmen, Jobs und Kontaktanfragen werden unwiderruflich gelöscht."}
                      </span>
                    </span>
                  </button>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="size-5" />
                Endgültig löschen
              </DialogTitle>
              <DialogDescription>
                Dieser Schritt kann nicht rückgängig gemacht werden. Tippe zur
                Bestätigung den Firmennamen ein.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="confirm-company-name">
                Firmenname{" "}
                <span className="font-normal text-muted-foreground">
                  ({loaded?.name ?? "…"})
                </span>
              </Label>
              <Input
                id="confirm-company-name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={loaded?.name ?? ""}
                autoComplete="off"
              />
              {confirmName.length > 0 && !nameMatches && (
                <p className="text-xs text-muted-foreground">
                  Der Name stimmt noch nicht überein.
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep("choice")}
                disabled={pending}
              >
                <ArrowLeft className="size-4" />
                Zurück
              </Button>
              <Button
                variant="destructive"
                onClick={hardDelete}
                disabled={pending || !nameMatches}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Ja, endgültig löschen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Zeilen-/Detail-Aktion: archiviertes Unternehmen wiederherstellen. */
export function RestoreCompanyButton({
  companyId,
  action,
  variant = "outline",
}: {
  companyId: string;
  action: (id: string) => Promise<ActionResult>;
  variant?: "outline" | "ghost";
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const restore = () =>
    startTransition(async () => {
      const result = await action(companyId).catch(() => ({
        ok: false as const,
        message: "Verbindung fehlgeschlagen.",
      }));
      if (result.ok) {
        toast.success(result.message ?? "Wiederhergestellt.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Wiederherstellen fehlgeschlagen.");
      }
    });

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={restore}
      disabled={pending}
      className={variant === "outline" ? "bg-card" : undefined}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ArchiveRestore className="size-4" />
      )}
      Wiederherstellen
    </Button>
  );
}
