"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { jobsFuerBetrieb, kandidatenVorschlagen } from "../vorschlag-actions";

interface Named {
  id: string;
  name: string;
}

const NONE = "__none__";

/**
 * „Kandidaten vorschlagen" — legt Vorschläge an einen Betrieb über den
 * Backend-Endpunkt an (source ADMIN). Eigene Mehrfachauswahl (unabhängig von der
 * Tabelle). Zeigt nur Namen, keine Kontaktdaten.
 */
export function VorschlagDialog({
  companies,
  kandidaten,
  preselected,
}: {
  companies: Named[];
  kandidaten: Named[];
  /** Optional vorausgewählte Kandidaten-IDs. */
  preselected?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [companyId, setCompanyId] = React.useState("");
  const [jobs, setJobs] = React.useState<{ id: string; title: string }[]>([]);
  const [jobsLaden, setJobsLaden] = React.useState(false);
  const [jobPostingId, setJobPostingId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(preselected ?? []),
  );
  const [suche, setSuche] = React.useState("");
  const [begruendung, setBegruendung] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const nameById = React.useMemo(
    () => new Map(kandidaten.map((k) => [k.id, k.name])),
    [kandidaten],
  );

  const gefiltert = React.useMemo(() => {
    const q = suche.trim().toLowerCase();
    const base = q
      ? kandidaten.filter((k) => k.name.toLowerCase().includes(q))
      : kandidaten;
    return base.slice(0, 60);
  }, [suche, kandidaten]);

  const reset = () => {
    setCompanyId("");
    setJobs([]);
    setJobPostingId(null);
    setSelected(new Set(preselected ?? []));
    setSuche("");
    setBegruendung("");
  };

  const waehleBetrieb = async (id: string) => {
    setCompanyId(id);
    setJobPostingId(null);
    setJobs([]);
    if (!id) return;
    setJobsLaden(true);
    try {
      setJobs(await jobsFuerBetrieb(id));
    } catch {
      setJobs([]);
    } finally {
      setJobsLaden(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const absenden = () =>
    startTransition(async () => {
      const res = await kandidatenVorschlagen({
        companyId,
        userIds: [...selected],
        jobPostingId,
        begruendung,
      }).catch(() => ({ ok: false as const, message: "Verbindung fehlgeschlagen." }));
      if (res.ok) {
        toast.success(
          `${res.angelegt} angelegt · ${res.aufgefrischt} aufgefrischt · ${res.uebersprungen} übersprungen`,
        );
        setOpen(false);
        reset();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });

  const betriebName = companies.find((c) => c.id === companyId)?.name;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button variant="outline" size="sm" className="bg-card" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Kandidaten vorschlagen
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kandidaten vorschlagen</DialogTitle>
          <DialogDescription>
            Legt Vorschläge beim Betrieb an. Vorhandene werden aufgefrischt statt
            verdoppelt; abgelehnte übersprungen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Betrieb</Label>
              <Select value={companyId} onValueChange={waehleBetrieb}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Betrieb wählen…" />
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
              <Label>
                Stelle{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={jobPostingId ?? NONE}
                onValueChange={(v) => setJobPostingId(v === NONE ? null : v)}
                disabled={!companyId || jobsLaden}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={jobsLaden ? "lädt…" : "ohne bestimmte Stelle"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ohne bestimmte Stelle</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Kandidaten{" "}
              <span className="font-normal text-muted-foreground">
                {selected.size > 0 ? `· ${selected.size} gewählt` : "· mind. 1"}
              </span>
            </Label>
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...selected].map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs font-medium text-secondary-foreground"
                  >
                    {nameById.get(id) ?? id}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="rounded-full p-0.5 hover:bg-foreground/10"
                      aria-label={`${nameById.get(id) ?? id} entfernen`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Kandidat suchen…"
                className="pl-8"
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border">
              {gefiltert.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Keine aktiven Kandidaten gefunden.
                </p>
              ) : (
                <ul className="divide-y">
                  {gefiltert.map((k) => {
                    const aktiv = selected.has(k.id);
                    return (
                      <li key={k.id}>
                        <button
                          type="button"
                          onClick={() => toggle(k.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60"
                        >
                          <span
                            className={
                              aktiv
                                ? "flex size-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-primary-foreground"
                                : "size-4 shrink-0 rounded border"
                            }
                          >
                            {aktiv && <X className="size-3 rotate-45" />}
                          </span>
                          {k.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vorschlag-grund">
              Begründung{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="vorschlag-grund"
              rows={2}
              maxLength={500}
              value={begruendung}
              onChange={(e) => setBegruendung(e.target.value)}
              placeholder={
                betriebName
                  ? `Warum passen diese Kandidaten zu ${betriebName}?`
                  : "Warum passen diese Kandidaten?"
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={absenden}
            disabled={pending || !companyId || selected.size === 0}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Vorschlagen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
