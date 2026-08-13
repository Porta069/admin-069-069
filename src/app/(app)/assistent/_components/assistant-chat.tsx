"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  frageAssistent,
  type AssistantAntwort,
  type AntwortBlock,
  type ListItem,
} from "../actions";

interface Nachricht {
  id: number;
  rolle: "user" | "assistent";
  frage?: string;
  antwort?: AssistantAntwort;
}

const BEISPIELE = [
  "Welche 10 Kandidaten passen zu Job Elektriker?",
  "Welche Kandidaten muss ich diese Woche kontaktieren?",
  "Fasse den Kontakt mit Betrieb Müller GmbH zusammen",
  "Entwirf eine E-Mail an Kandidat Max Mustermann wegen Interviewtermin",
];

function scoreClass(score: number): string {
  if (score >= 80) return "bg-success-soft text-success";
  if (score >= 60) return "bg-warning-soft text-warning";
  return "bg-muted text-muted-foreground";
}

function ScoreChip({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular",
        scoreClass(score),
      )}
    >
      {score}%
    </span>
  );
}

function ListeBlock({ items, leerText }: { items: ListItem[]; leerText?: string }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {leerText ?? "Keine Einträge."}
      </p>
    );
  }
  return (
    <ol className="space-y-1.5">
      {items.map((item, i) => {
        const inner = (
          <>
            <span className="mt-0.5 w-4 shrink-0 text-right text-xs text-muted-foreground tabular">
              {i + 1}.
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium">
                <span className="truncate">{item.titel}</span>
                {item.href && (
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
              {(item.meta || item.sub) && (
                <span className="block truncate text-xs text-muted-foreground">
                  {[item.meta, item.sub].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            {item.score !== undefined && <ScoreChip score={item.score} />}
          </>
        );
        return (
          <li key={i}>
            {item.href ? (
              <Link
                href={item.href}
                className="group flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/50"
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-start gap-2 px-2 py-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function EmailBlock({ betreff, text }: { betreff: string; text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Betreff: ${betreff}\n\n${text}`);
      setCopied(true);
      toast.success("Entwurf kopiert.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Kopieren nicht möglich.");
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Betreff</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{betreff}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Kopieren
        </Button>
      </div>
      <p className="px-3 py-2.5 text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function BlockView({ block }: { block: AntwortBlock }) {
  switch (block.typ) {
    case "text":
      return <p className="text-sm whitespace-pre-wrap">{block.text}</p>;
    case "hinweis":
      return (
        <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{block.text}</span>
        </div>
      );
    case "liste":
      return <ListeBlock items={block.items} leerText={block.leerText} />;
    case "email":
      return <EmailBlock betreff={block.betreff} text={block.text} />;
    case "wahl":
      return (
        <div className="space-y-1.5">
          <p className="text-sm">{block.frage}</p>
          <div className="flex flex-wrap gap-1.5">
            {block.optionen.map((o, i) => (
              <Link
                key={i}
                href={o.href}
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
      );
  }
}

function AntwortView({ antwort }: { antwort: AssistantAntwort }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{antwort.einleitung}</p>
      {antwort.bloecke.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      {antwort.kiHinweis && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3" />
          Die formulierte Fassung folgt, sobald der KI-Provider verbunden ist.
        </p>
      )}
      {antwort.quellen.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
          <span className="text-xs text-muted-foreground">Quellen:</span>
          {antwort.quellen.map((q, i) => (
            <Link
              key={i}
              href={q.href}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium hover:bg-accent"
            >
              {q.label}
              <ExternalLink className="size-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AssistantChat() {
  const [nachrichten, setNachrichten] = React.useState<Nachricht[]>([]);
  const [eingabe, setEingabe] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const idRef = React.useRef(0);
  const endeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [nachrichten, pending]);

  const senden = (fragetext: string) => {
    const frage = fragetext.trim();
    if (!frage || pending) return;
    const userMsg: Nachricht = { id: ++idRef.current, rolle: "user", frage };
    setNachrichten((m) => [...m, userMsg]);
    setEingabe("");

    startTransition(async () => {
      try {
        const antwort = await frageAssistent(frage);
        setNachrichten((m) => [
          ...m,
          { id: ++idRef.current, rolle: "assistent", antwort },
        ]);
      } catch {
        toast.error("Der Assistent ist gerade nicht erreichbar.");
        setNachrichten((m) => [
          ...m,
          {
            id: ++idRef.current,
            rolle: "assistent",
            antwort: {
              intent: "fehler",
              einleitung: "Der Assistent ist gerade nicht erreichbar.",
              bloecke: [],
              quellen: [],
            },
          },
        ]);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      senden(eingabe);
    }
  };

  const leer = nachrichten.length === 0;

  return (
    <div className="flex min-h-[60vh] flex-col rounded-lg border bg-card">
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {leer ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Bot className="size-6 text-primary" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold">
              Wie kann ich helfen?
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Frag nach passenden Kandidaten, offenen Kontakten, einer
              Kontakt-Zusammenfassung oder einem E-Mail-Entwurf. Die Daten kommen
              direkt aus deinem Dashboard.
            </p>
            <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {BEISPIELE.map((b) => (
                <button
                  key={b}
                  onClick={() => senden(b)}
                  className="group flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <Sparkles className="size-3.5 shrink-0 text-primary/70" />
                  <span className="min-w-0 flex-1">{b}</span>
                  <ArrowUp className="size-3.5 shrink-0 rotate-45 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          nachrichten.map((m) =>
            m.rolle === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {m.frage}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-background px-4 py-3">
                  {m.antwort && <AntwortView antwort={m.antwort} />}
                </div>
              </div>
            ),
          )
        )}

        {pending && (
          <div className="flex gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-background px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Ich sehe nach…
            </div>
          </div>
        )}
        <div ref={endeRef} />
      </div>

      <div className="border-t bg-card p-3 sm:p-4">
        <div className="relative flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <Textarea
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Frag den Assistenten… (Enter zum Senden, Shift+Enter für neue Zeile)"
            className="max-h-40 min-h-0 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-lg"
            onClick={() => senden(eingabe)}
            disabled={pending || eingabe.trim() === ""}
            aria-label="Senden"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Der Assistent zeigt nur Daten, die deine Berechtigungen freigeben.
        </p>
      </div>
    </div>
  );
}
