"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ExportModul =
  | "kandidaten"
  | "unternehmen"
  | "stellen"
  | "bewerbungen"
  | "vermittlungen"
  | "referrals";

/**
 * Startet den CSV-Export für das aktuelle Modul mit den aktiven
 * Listen-Filtern (Query-Params werden 1:1 an den Route Handler gereicht).
 */
export function ExportButton({ modul }: { modul: ExportModul }) {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const href = `/api/export/${modul}${qs ? `?${qs}` : ""}`;

  return (
    <Button asChild variant="outline" size="sm" className="bg-card">
      <a href={href} download>
        <Download className="size-3.5" />
        CSV exportieren
      </a>
    </Button>
  );
}
