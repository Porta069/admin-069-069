import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-lg font-semibold">Seite nicht gefunden</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Diese Seite oder dieser Datensatz existiert nicht (mehr) oder wurde
          verschoben.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/">
          <ArrowLeft className="size-4" /> Zur Übersicht
        </Link>
      </Button>
    </div>
  );
}
