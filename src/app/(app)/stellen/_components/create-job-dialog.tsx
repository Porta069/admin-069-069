"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJob } from "../actions";
import { GEWERK_OPTIONS } from "../_lib/job-criteria";
import { Loader2, Plus } from "lucide-react";

/** „Stelle anlegen" — minimaler Start, Kriterien danach im Editor pflegen. */
export function CreateJobDialog({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(searchParams.get("neu") === "1");
  const [pending, startTransition] = React.useTransition();
  const [companyId, setCompanyId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [city, setCity] = React.useState("");
  const [gewerke, setGewerke] = React.useState<string[]>([]);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next && searchParams.get("neu") === "1") {
      const params = new URLSearchParams(searchParams);
      params.delete("neu");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const submit = () =>
    startTransition(async () => {
      const result = await createJob({
        companyId,
        title,
        city,
        gewerke,
        status: "DRAFT",
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (result.ok) {
        toast.success(result.message ?? "Stelle angelegt.");
        close(false);
        if ("jobId" in result && result.jobId) {
          router.push(`/stellen/${result.jobId}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.message);
      }
    });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Stelle anlegen
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stelle anlegen</DialogTitle>
            <DialogDescription>
              Startet als Entwurf — Anforderungen und Gewichte pflegst du
              danach im Kriterien-Editor der Stelle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Unternehmen</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unternehmen wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="neu-titel">Jobtitel</Label>
              <Input
                id="neu-titel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Elektroniker für Energie- und Gebäudetechnik (m/w/d)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="neu-stadt">
                Stadt{" "}
                <span className="font-normal text-muted-foreground">
                  (leer = Ort des Unternehmens)
                </span>
              </Label>
              <Input
                id="neu-stadt"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gewerk(e) der Stelle</Label>
              <p className="text-xs text-muted-foreground">
                Erstes gewähltes Gewerk ist das Gewerk der Stelle; alle gewählten
                gelten als akzeptierte Gewerke fürs Matching.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GEWERK_OPTIONS.map((o) => {
                  const aktiv = gewerke.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        setGewerke((prev) =>
                          aktiv
                            ? prev.filter((b) => b !== o.value)
                            : [...prev, o.value],
                        )
                      }
                      className={
                        aktiv
                          ? "rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                          : "rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/50"
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submit}
              disabled={pending || !companyId || !title.trim() || gewerke.length === 0}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
