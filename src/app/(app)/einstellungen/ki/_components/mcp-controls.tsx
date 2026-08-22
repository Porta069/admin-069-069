"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setMcpAktiv, setMcpSchreiben } from "../actions";
import { CircleCheck, PauseCircle, ShieldAlert } from "lucide-react";

export function McpControls({
  initial,
  canEdit,
}: {
  initial: { aktiv: boolean; schreiben: boolean };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [aktiv, setAktiv] = React.useState(initial.aktiv);
  const [schreiben, setSchreiben] = React.useState(initial.schreiben);
  const [pending, setPending] = React.useState(false);

  async function toggleAktiv(v: boolean) {
    setAktiv(v);
    setPending(true);
    const res = await setMcpAktiv(v);
    setPending(false);
    if (res.ok) {
      toast.success(v ? "MCP-Zugriff aktiviert." : "MCP-Zugriff pausiert.");
      router.refresh();
    } else {
      setAktiv(!v);
      toast.error(res.message);
    }
  }

  async function toggleSchreiben(v: boolean) {
    setSchreiben(v);
    setPending(true);
    const res = await setMcpSchreiben(v);
    setPending(false);
    if (res.ok) {
      toast.success(v ? "Schreibzugriff aktiviert." : "Schreibzugriff pausiert — nur Lesen.");
      router.refresh();
    } else {
      setSchreiben(!v);
      toast.error(res.message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status-Banner */}
      <div
        className={
          aktiv
            ? "flex items-center gap-2.5 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"
            : "flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
        }
      >
        {aktiv ? <CircleCheck className="size-4 shrink-0" /> : <PauseCircle className="size-4 shrink-0" />}
        <span>
          {aktiv
            ? schreiben
              ? "Aktiv — die Claude-App kann lesen und schreiben."
              : "Aktiv — die Claude-App kann nur lesen (Schreiben pausiert)."
            : "Pausiert — die Claude-App hat aktuell keinen Zugriff."}
        </span>
      </div>

      <div className="divide-y rounded-lg border">
        <label className="flex items-center justify-between gap-4 p-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium">MCP-Zugriff aktiv</span>
            <span className="block text-xs text-muted-foreground">
              Not-Aus für den gesamten Zugriff der Claude-App. Aus = alle Tools
              werden abgelehnt (und der Versuch protokolliert).
            </span>
          </span>
          <Switch checked={aktiv} disabled={!canEdit || pending} onCheckedChange={toggleAktiv} />
        </label>

        <label className="flex items-center justify-between gap-4 p-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium">Schreibzugriff erlauben</span>
            <span className="block text-xs text-muted-foreground">
              Aus = die Claude-App darf nur lesen; Anlegen/Ändern/Löschen,
              E-Mail-Versand und Sync werden blockiert.
            </span>
          </span>
          <Switch
            checked={schreiben}
            disabled={!canEdit || pending || !aktiv}
            onCheckedChange={toggleSchreiben}
          />
        </label>
      </div>

      {!canEdit && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          Nur mit dem Recht „Einstellungen bearbeiten" änderbar.
        </p>
      )}
    </div>
  );
}
