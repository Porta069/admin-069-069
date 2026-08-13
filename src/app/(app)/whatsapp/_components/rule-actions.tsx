"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteRule } from "../actions";
import {
  EditRuleDialog,
  type RuleFormData,
  type TemplateOption,
} from "./rule-dialog";

export function RuleActions({
  rule,
  templates,
  canEdit,
}: {
  rule: RuleFormData;
  templates: TemplateOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (!canEdit) return null;

  const remove = () =>
    startTransition(async () => {
      const result = await deleteRule(rule.id);
      if (result.ok) {
        toast.success("Regel gelöscht");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <div className="flex items-center justify-end gap-1">
      <EditRuleDialog
        templates={templates}
        rule={rule}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Regel bearbeiten"
          >
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Weitere Aktionen"
            disabled={pending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <Trash2 className="size-4" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
