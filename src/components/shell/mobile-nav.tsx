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
import { triggerSplash } from "./logo-splash";
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
            <button
              type="button"
              onClick={() => triggerSplash()}
              className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 transition-transform active:scale-95"
              aria-label="Werkpair – Animation abspielen"
            >
              <img
                src="/porta-werk-logo.jpg"
                alt="Werkpair"
                className="h-5 w-auto"
                draggable={false}
              />
            </button>
            <span className="sr-only">Werkpair</span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(100%-65px)] flex-col">
          <SidebarNav allowedHrefs={allowedHrefs} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
