"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Löst den Systemdruck-Dialog aus (kein externes PDF-Lib nötig). */
export function PrintButton() {
  return (
    <Button
      size="sm"
      variant="outline"
      className="bg-card print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-3.5" />
      Drucken / PDF
    </Button>
  );
}
