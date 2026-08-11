"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Handshake,
  Loader2,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AUDIENCE_TYP_LABELS,
  MAX_RECIPIENTS,
  SAMPLE_VARS,
  TEMPLATE_VARS,
  formatAudience,
  type Audience,
  type AudienceTyp,
} from "../campaign-defs";
import { countRecipients, launchCampaign, saveDraft } from "../actions";

export interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const ALL = "__alle__";
const NO_TEMPLATE = "__keine__";

const AUDIENCE_ICONS: Record<AudienceTyp, React.ElementType> = {
  kandidaten: Users,
  unternehmen: Building2,
  partner: Handshake,
};

const AUDIENCE_HINTS: Record<AudienceTyp, string> = {
  kandidaten: "Handwerker mit hinterlegter E-Mail",
  unternehmen: "Betriebe mit Kontakt-E-Mail",
  partner: "Alle Affiliate-Partner",
};

/** Vorschau: Variablen durch Beispielwerte ersetzen und farbig markieren. */
function previewNodes(text: string): React.ReactNode {
  const parts = text.split(/(\{[a-z_]+\})/g);
  return parts.map((part, i) => {
    const match = /^\{([a-z_]+)\}$/.exec(part);
    if (!match) return <React.Fragment key={i}>{part}</React.Fragment>;
    const sample = SAMPLE_VARS[match[1]];
    return sample !== undefined ? (
      <span
        key={i}
        className="rounded-sm bg-primary/10 px-0.5 font-medium text-primary"
        title={part}
      >
        {sample}
      </span>
    ) : (
      <span key={i} className="rounded-sm bg-warning-soft px-0.5 font-mono text-xs text-warning">
        {part}
      </span>
    );
  });
}

function StepHeader({
  step,
  title,
  hint,
}: {
  step: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b px-5 py-3.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-xs font-semibold text-primary">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </header>
  );
}

export function CampaignForm({
  bundeslaender,
  berufe,
  orte,
  templates,
  mailerReady,
}: {
  bundeslaender: string[];
  berufe: string[];
  orte: string[];
  templates: TemplateOption[];
  mailerReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState("");
  const [typ, setTyp] = React.useState<AudienceTyp>("kandidaten");
  const [bundesland, setBundesland] = React.useState(ALL);
  const [beruf, setBeruf] = React.useState(ALL);
  const [verifiziert, setVerifiziert] = React.useState(false);
  const [ort, setOrt] = React.useState(ALL);
  const [templateId, setTemplateId] = React.useState(NO_TEMPLATE);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const [count, setCount] = React.useState<number | null>(null);
  const [counting, setCounting] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const countRequest = React.useRef(0);

  const audience: Audience = React.useMemo(() => {
    if (typ === "kandidaten") {
      return {
        typ,
        bundesland: bundesland === ALL ? null : bundesland,
        beruf: beruf === ALL ? null : beruf,
        verifiziert,
      };
    }
    if (typ === "unternehmen") {
      return { typ, ort: ort === ALL ? null : ort };
    }
    return { typ };
  }, [typ, bundesland, beruf, verifiziert, ort]);

  const refreshCount = React.useCallback(async (a: Audience) => {
    const requestId = ++countRequest.current;
    setCounting(true);
    const result = await countRecipients(a);
    if (requestId !== countRequest.current) return; // veraltete Antwort
    setCounting(false);
    if (result.ok) setCount(result.count);
    else {
      setCount(null);
      toast.error(result.message);
    }
  }, []);

  // Live-Zählung: automatisch (entprellt) nach jeder Zielgruppen-Änderung.
  React.useEffect(() => {
    const timer = setTimeout(() => void refreshCount(audience), 500);
    return () => clearTimeout(timer);
  }, [audience, refreshCount]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === NO_TEMPLATE) return;
    const template = templates.find((t) => t.id === id);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const insertVariable = (variable: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + variable + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const validate = (forLaunch: boolean): boolean => {
    if (!name.trim()) {
      toast.error("Bitte einen internen Namen angeben.");
      return false;
    }
    if (forLaunch && (!subject.trim() || !body.trim())) {
      toast.error("Bitte Betreff und Inhalt ausfüllen.");
      return false;
    }
    if (forLaunch && count !== null && count === 0) {
      toast.error("Für diese Zielgruppe wurden keine Empfänger gefunden.");
      return false;
    }
    if (forLaunch && count !== null && count > MAX_RECIPIENTS) {
      toast.error(
        `Maximal ${formatNumber(MAX_RECIPIENTS)} Empfänger pro Kampagne — bitte die Zielgruppe weiter eingrenzen.`,
      );
      return false;
    }
    return true;
  };

  const submitDraft = () => {
    if (!validate(false)) return;
    startTransition(async () => {
      const result = await saveDraft({ name, subject, body, audience });
      if (result.ok) {
        toast.success(result.message ?? "Entwurf gespeichert.");
        router.push(result.id ? `/kampagnen/${result.id}` : "/kampagnen");
      } else {
        toast.error(result.message);
      }
    });
  };

  const submitLaunch = () => {
    startTransition(async () => {
      const result = await launchCampaign({ name, subject, body, audience });
      if (result.ok) {
        setConfirmOpen(false);
        toast.success(result.message ?? "Kampagne in Versand gegeben.");
        router.push(result.id ? `/kampagnen/${result.id}` : "/kampagnen");
      } else {
        toast.error(result.message);
      }
    });
  };

  const selectableBerufe = berufe.filter((b) => b !== ALL);
  const overLimit = count !== null && count > MAX_RECIPIENTS;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
      {/* Schritte */}
      <div className="space-y-5">
        {/* (a) Name */}
        <section className="rounded-lg border bg-card">
          <StepHeader
            step="1"
            title="Grundlagen"
            hint="Interner Name — Empfänger sehen ihn nicht."
          />
          <div className="p-5">
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="pw-camp-name">Name der Kampagne *</Label>
              <Input
                id="pw-camp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Frühjahrs-Rundmail Elektriker Bayern"
                maxLength={200}
              />
            </div>
          </div>
        </section>

        {/* (b) Zielgruppe */}
        <section className="rounded-lg border bg-card">
          <StepHeader
            step="2"
            title="Zielgruppe"
            hint="Wer soll die Rundmail erhalten?"
          />
          <div className="space-y-4 p-5">
            <div
              role="radiogroup"
              aria-label="Empfängergruppe"
              className="grid gap-2 sm:grid-cols-3"
            >
              {(Object.keys(AUDIENCE_TYP_LABELS) as AudienceTyp[]).map((t) => {
                const Icon = AUDIENCE_ICONS[t];
                const active = typ === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTyp(t)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {AUDIENCE_TYP_LABELS[t]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {AUDIENCE_HINTS[t]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {typ === "kandidaten" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Bundesland</Label>
                  <Select value={bundesland} onValueChange={setBundesland}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Alle Bundesländer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Bundesländer</SelectItem>
                      {bundeslaender.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Beruf</Label>
                  <Select value={beruf} onValueChange={setBeruf}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Alle Berufe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Berufe</SelectItem>
                      {selectableBerufe.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 pt-1 text-sm sm:col-span-2">
                  <Checkbox
                    checked={verifiziert}
                    onCheckedChange={(v) => setVerifiziert(v === true)}
                  />
                  Nur verifizierte Kandidaten
                </label>
              </div>
            )}

            {typ === "unternehmen" && (
              <div className="max-w-xs space-y-1.5">
                <Label>Ort</Label>
                <Select value={ort} onValueChange={setOrt}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Alle Orte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Alle Orte</SelectItem>
                    {orte.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {typ === "partner" && (
              <p className="text-sm text-muted-foreground">
                Alle Partner mit hinterlegter E-Mail-Adresse — keine weiteren
                Filter.
              </p>
            )}
          </div>
        </section>

        {/* (c) Inhalt */}
        <section className="rounded-lg border bg-card">
          <StepHeader
            step="3"
            title="Inhalt"
            hint="Betreff und Text — Variablen werden pro Empfänger ersetzt."
          />
          <div className="space-y-4 p-5">
            {templates.length > 0 && (
              <div className="max-w-md space-y-1.5">
                <Label>Vorlage übernehmen</Label>
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Ohne Vorlage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEMPLATE}>Ohne Vorlage</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Füllt Betreff und Text — kann danach frei angepasst werden.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pw-camp-subject">Betreff *</Label>
              <Input
                id="pw-camp-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="z. B. Neue Stellen für {first_name} in Ihrer Region"
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pw-camp-body">Nachricht *</Label>
              <Textarea
                id="pw-camp-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder={"Hallo {first_name},\n\n…"}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Variablen:</span>
                {TEMPLATE_VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded-full border bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    title="An Cursorposition einfügen"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* (d) Vorschau */}
        <section className="rounded-lg border bg-card">
          <StepHeader
            step="4"
            title="Vorschau"
            hint="So sieht die Mail mit Beispielwerten aus."
          />
          <div className="p-5">
            {subject.trim() === "" && body.trim() === "" ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Sobald Betreff oder Nachricht ausgefüllt sind, erscheint hier
                die Vorschau.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="border-b bg-muted/40 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">Betreff</p>
                  <p className="text-sm font-medium">
                    {subject.trim() === "" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      previewNodes(subject)
                    )}
                  </p>
                </div>
                <div className="px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {body.trim() === "" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    previewNodes(body)
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Zusammenfassung + Aktionen */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Empfänger
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p
              className={cn(
                "font-display text-3xl leading-none font-semibold tabular",
                overLimit && "text-destructive",
              )}
            >
              {counting ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : count === null ? (
                "—"
              ) : (
                formatNumber(count)
              )}
            </p>
            {!counting && count !== null && (
              <span className="text-xs text-muted-foreground">
                nach Dedupe je E-Mail
              </span>
            )}
          </div>
          {overLimit && (
            <p className="mt-2 text-xs text-destructive">
              Über dem Limit von {formatNumber(MAX_RECIPIENTS)} Empfängern —
              bitte Zielgruppe eingrenzen.
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {formatAudience(audience)}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => void refreshCount(audience)}
            disabled={counting}
          >
            <RefreshCw className={cn("size-3.5", counting && "animate-spin")} />
            Empfänger zählen
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <Button
            className="w-full"
            onClick={() => {
              if (validate(true)) setConfirmOpen(true);
            }}
            disabled={pending || counting}
          >
            <Send className="size-4" />
            Jetzt in Versand geben
          </Button>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={submitDraft}
            disabled={pending}
          >
            {pending ? "Speichert…" : "Als Entwurf speichern"}
          </Button>
          <Separator className="my-4" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {mailerReady
              ? "Der Versand startet unmittelbar über den verbundenen E-Mail-Provider."
              : "Ohne verbundenen Provider werden die Mails in der Outbox gesammelt und nach dem Verbinden automatisch versendet."}
          </p>
        </div>
      </aside>

      {/* Bestätigung Versand */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kampagne in Versand geben?</DialogTitle>
            <DialogDescription>
              „{name.trim() || "Unbenannte Kampagne"}“ wird an{" "}
              <span className="font-medium text-foreground">
                {count === null ? "die gewählte Zielgruppe" : `${formatNumber(count)} Empfänger`}
              </span>{" "}
              ({formatAudience(audience)}) gesendet. Dieser Schritt kann nur
              über „Abbrechen“ auf der Kampagnenseite gestoppt werden.
            </DialogDescription>
          </DialogHeader>
          {!mailerReady && (
            <p className="rounded-lg bg-info-soft px-3 py-2.5 text-xs text-info">
              E-Mail-Provider noch nicht verbunden — die Mails warten in der
              Outbox und gehen nach dem Verbinden automatisch raus.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Zurück
            </Button>
            <Button onClick={submitLaunch} disabled={pending}>
              {pending ? "Wird vorbereitet…" : "Versand starten"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
