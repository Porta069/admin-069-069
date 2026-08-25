"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addFirewallRule, deleteFirewallRule } from "../actions";

export interface RuleRow {
  id: string;
  rule_type: "BLOCK_IP" | "ALLOW_IP";
  pattern: string;
  note: string | null;
  created_at: string;
}

export function FirewallRules({ rules }: { rules: RuleRow[] }) {
  const router = useRouter();
  const [ruleType, setRuleType] = React.useState<"BLOCK_IP" | "ALLOW_IP">("BLOCK_IP");
  const [pattern, setPattern] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const add = async () => {
    if (!pattern.trim()) return;
    setPending(true);
    const res = await addFirewallRule({ ruleType, pattern, note });
    setPending(false);
    if (res.ok) {
      toast.success(ruleType === "BLOCK_IP" ? "IP gesperrt." : "IP freigegeben.");
      setPattern("");
      setNote("");
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRuleType("BLOCK_IP")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
              ruleType === "BLOCK_IP"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "hover:bg-muted",
            )}
          >
            <Ban className="size-4" /> IP sperren
          </button>
          <button
            type="button"
            onClick={() => setRuleType("ALLOW_IP")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
              ruleType === "ALLOW_IP"
                ? "border-success/40 bg-success-soft text-success"
                : "hover:bg-muted",
            )}
          >
            <ShieldCheck className="size-4" /> IP freigeben
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="IP oder Präfix, z. B. 203.0.113.7"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz (optional)"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={pending || !pattern.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Hinzufügen
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Präfixe enden mit einem Punkt (z. B. <code>203.0.113.</code> sperrt den
          ganzen Bereich). Freigaben haben Vorrang vor Sperren — die eigene IP
          kann nicht gesperrt werden.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Keine dynamischen IP-Regeln.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  r.rule_type === "BLOCK_IP"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-success-soft text-success",
                )}
              >
                {r.rule_type === "BLOCK_IP" ? <Ban className="size-4" /> : <ShieldCheck className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{r.pattern}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.rule_type === "BLOCK_IP" ? "Gesperrt" : "Freigegeben"}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <DeleteButton id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await deleteFirewallRule(id);
        setPending(false);
        if (res.ok) {
          toast.success("Regel entfernt.");
          router.refresh();
        } else toast.error(res.message);
      }}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Regel löschen"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
