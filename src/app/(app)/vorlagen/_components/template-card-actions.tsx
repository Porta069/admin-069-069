"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { duplicateTemplate, deleteTemplate } from "../actions";
import { TemplateDialog, type TemplateFormData } from "./template-dialog";

export function TemplateCardActions({
  template,
  canEdit,
  canCreate,
  canDelete,
}: {
  template: TemplateFormData;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (!canEdit && !canCreate && !canDelete) return null;

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.message ?? "Aktion fehlgeschlagen");
      }
    });

  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <TemplateDialog
          template={template}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Vorlage bearbeiten"
            >
              <Pencil className="size-4" />
            </Button>
          }
        />
      )}
      {(canCreate || canDelete) && (
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(o) => {
            setMenuOpen(o);
            if (!o) setConfirmDelete(false);
          }}
        >
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
            {canCreate && (
              <DropdownMenuItem
                onClick={() =>
                  run(() => duplicateTemplate(template.id), "Vorlage dupliziert")
                }
              >
                <Copy className="size-4" />
                Duplizieren
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                {canCreate && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    if (!confirmDelete) {
                      e.preventDefault();
                      setConfirmDelete(true);
                      return;
                    }
                    run(() => deleteTemplate(template.id), "Vorlage gelöscht");
                  }}
                >
                  <Trash2 className="size-4" />
                  {confirmDelete ? "Wirklich löschen?" : "Löschen"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
