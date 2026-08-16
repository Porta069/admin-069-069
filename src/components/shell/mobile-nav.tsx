"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { Menu } from "lucide-react";

export function MobileNav({ allowedHrefs }: { allowedHrefs: string[] }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Navigation schließt automatisch nach Routenwechsel
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8.5 bg-card lg:hidden"
          aria-label="Navigation öffnen"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5">
              <img
                src="/porta-werk-logo.jpg"
                alt="Porta Werk"
                className="h-5 w-auto"
                draggable={false}
              />
            </span>
            <span className="sr-only">Porta Werk</span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(100%-65px)] flex-col">
          <SidebarNav allowedHrefs={allowedHrefs} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
