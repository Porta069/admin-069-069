"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addSettingListValue, removeSettingListValue } from "../actions";
import type { ListSettingKey } from "./setting-defaults";

export function StatusListEditor({
  settingKey,
  values,
  canEdit,
  placeholder,
}: {
  settingKey: ListSettingKey;
  values: string[];
  canEdit: boolean;
  placeholder: string;
}) {
  const router = useRouter();
  const [newValue, setNewValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !newValue.trim()) return;
    setPending(true);
    const result = await addSettingListValue(settingKey, newValue);
    setPending(false);
    if (result.ok) {
      toast.success("Wert wurde hinzugefügt");
      setNewValue("");
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const remove = async (value: string) => {
    if (removing) return;
    setRemoving(value);
    const result = await removeSettingListValue(settingKey, value);
    setRemoving(null);
    if (result.ok) {
      toast.success(`„${value}" wurde entfernt`);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap items-center gap-1.5">
        {values.map((value, i) => (
          <li
            key={value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-secondary py-1 pl-2.5 text-xs font-medium text-secondary-foreground",
              canEdit ? "pr-1" : "pr-2.5",
            )}
          >
            <span className="text-muted-foreground/70 tabular">{i + 1}</span>
            {value}
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(value)}
                disabled={removing !== null}
                className="flex size-4.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`„${value}" entfernen`}
              >
                {removing === value ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
              </button>
            )}
          </li>
        ))}
      </ol>
      {canEdit && (
        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={placeholder}
            maxLength={40}
            className="h-9 w-56"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-9 bg-card"
            disabled={pending || !newValue.trim()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Hinzufügen
          </Button>
        </form>
      )}
    </div>
  );
}
