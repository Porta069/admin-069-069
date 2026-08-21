"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DEFAULT_RESET_EMAIL,
  renderResetEmail,
  type ResetEmailConfig,
} from "@/lib/reset-email";
import { saveResetEmail, resetToDefault, sendResetTest } from "../actions";
import { Loader2, Monitor, Smartphone, RotateCcw, Save, Send, Upload, Image as ImageIcon } from "lucide-react";

const MAX_LOGO_BYTES = 500 * 1024;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ResetEmailEditor({
  initial,
  canEdit,
  testEmail,
}: {
  initial: ResetEmailConfig;
  canEdit: boolean;
  testEmail: string;
}) {
  const router = useRouter();
  const [cfg, setCfg] = React.useState<ResetEmailConfig>(initial);
  const [dirty, setDirty] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [view, setView] = React.useState<"desktop" | "mobile">("desktop");
  const [testTo, setTestTo] = React.useState(testEmail);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof ResetEmailConfig>(k: K, val: ResetEmailConfig[K]) => {
    setCfg((p) => ({ ...p, [k]: val }));
    setDirty(true);
  };

  const previewHtml = React.useMemo(
    () =>
      renderResetEmail(cfg, {
        reset_url: "https://portajobs.de/passwort/neu?token=VORSCHAU",
        name: "",
      }).html,
    [cfg],
  );

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte eine Bilddatei wählen.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo zu groß (max. 500 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set("logoUrl", String(reader.result));
      toast.success("Logo aktualisiert (noch nicht gespeichert).");
    };
    reader.readAsDataURL(file);
  }

  async function onSave() {
    setPending(true);
    const res = await saveResetEmail(cfg);
    setPending(false);
    if (res.ok) {
      toast.success("Vorlage gespeichert.");
      setDirty(false);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  async function onReset() {
    setPending(true);
    const res = await resetToDefault();
    setPending(false);
    if (res.ok) {
      setCfg(DEFAULT_RESET_EMAIL);
      setDirty(false);
      toast.success("Auf Standard-Design zurückgesetzt.");
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  async function onTest() {
    setPending(true);
    const res = await sendResetTest(testTo);
    setPending(false);
    if (res.ok) toast.success(`Test-E-Mail an ${testTo} verschickt.`);
    else toast.error(res.message);
  }

  const ro = !canEdit;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Felder ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        {ro && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Nur-Lesen — dir fehlt das Recht „Vorlagen bearbeiten".
          </p>
        )}

        <Section title="Logo & Marke">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-md border bg-white p-1.5">
              {cfg.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cfg.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              <Button type="button" size="sm" variant="outline" disabled={ro} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Logo hochladen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={ro}
                className="text-muted-foreground"
                onClick={() => set("logoUrl", DEFAULT_RESET_EMAIL.logoUrl)}
              >
                Standard-Logo
              </Button>
            </div>
          </div>
          <Field label="Logo-URL / Data-URI" hint="Upload füllt dies automatisch. Für E-Mails ist eine Data-URI am zuverlässigsten.">
            <Input value={cfg.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} disabled={ro} className="font-mono text-xs" />
          </Field>
          <Field label="Markenname (Platzhalter {{brand}})">
            <Input value={cfg.brand} onChange={(e) => set("brand", e.target.value)} disabled={ro} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Akzentfarbe (Orange)">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.colorOrange} onChange={(e) => set("colorOrange", e.target.value)} disabled={ro} className="h-9 w-10 rounded border" />
                <Input value={cfg.colorOrange} onChange={(e) => set("colorOrange", e.target.value)} disabled={ro} className="font-mono text-xs" />
              </div>
            </Field>
            <Field label="Dunkelton (Petrol)">
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.colorPetrol} onChange={(e) => set("colorPetrol", e.target.value)} disabled={ro} className="h-9 w-10 rounded border" />
                <Input value={cfg.colorPetrol} onChange={(e) => set("colorPetrol", e.target.value)} disabled={ro} className="font-mono text-xs" />
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Kopf & Headline">
          <Field label="Betreff">
            <Input value={cfg.subject} onChange={(e) => set("subject", e.target.value)} disabled={ro} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Headline oben">
              <Input value={cfg.headlineTop} onChange={(e) => set("headlineTop", e.target.value)} disabled={ro} />
            </Field>
            <Field label="Headline unten (Akzent)">
              <Input value={cfg.headlineBottom} onChange={(e) => set("headlineBottom", e.target.value)} disabled={ro} />
            </Field>
          </div>
        </Section>

        <Section title="Text">
          <Field label="Anrede" hint="{{name}} = Empfängername (optional).">
            <Input value={cfg.greeting} onChange={(e) => set("greeting", e.target.value)} disabled={ro} />
          </Field>
          <Field label="Einleitung" hint="{{brand}} wird farbig hervorgehoben.">
            <Textarea rows={3} value={cfg.intro} onChange={(e) => set("intro", e.target.value)} disabled={ro} />
          </Field>
          <Field label="Hinweis vor dem Button">
            <Textarea rows={2} value={cfg.ctaHint} onChange={(e) => set("ctaHint", e.target.value)} disabled={ro} />
          </Field>
        </Section>

        <Section title="Button">
          <Field label="Button-Beschriftung">
            <Input value={cfg.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} disabled={ro} />
          </Field>
          <Field label="Button-Link" hint="Muss {{reset_url}} enthalten — das ist der eigentliche Reset-Link.">
            <Input value={cfg.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} disabled={ro} className="font-mono text-xs" />
          </Field>
        </Section>

        <Section title="Boxen">
          <Field label="Info-Box (Petrol-Rand)">
            <Textarea rows={2} value={cfg.infoBox} onChange={(e) => set("infoBox", e.target.value)} disabled={ro} />
          </Field>
          <Field label="Hinweis-Box (Orange-Rand)">
            <Textarea rows={3} value={cfg.noteBox} onChange={(e) => set("noteBox", e.target.value)} disabled={ro} />
          </Field>
        </Section>

        <Section title="Signatur & Footer">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grußformel">
              <Input value={cfg.signOff} onChange={(e) => set("signOff", e.target.value)} disabled={ro} />
            </Field>
            <Field label="Team-Zeile" hint="{{brand}}">
              <Input value={cfg.signTeam} onChange={(e) => set("signTeam", e.target.value)} disabled={ro} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Footer-Akzent">
              <Input value={cfg.footerAccent} onChange={(e) => set("footerAccent", e.target.value)} disabled={ro} />
            </Field>
            <Field label="Footer-Rest">
              <Input value={cfg.footerRest} onChange={(e) => set("footerRest", e.target.value)} disabled={ro} />
            </Field>
          </div>
        </Section>
      </div>

      {/* ── Vorschau + Aktionen ────────────────────────────────── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Live-Vorschau</span>
            {dirty && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">ungespeichert</span>}
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" size="icon" variant={view === "desktop" ? "secondary" : "ghost"} className="size-7" onClick={() => setView("desktop")} aria-label="Desktop-Vorschau">
                <Monitor className="size-4" />
              </Button>
              <Button type="button" size="icon" variant={view === "mobile" ? "secondary" : "ghost"} className="size-7" onClick={() => setView("mobile")} aria-label="Mobil-Vorschau">
                <Smartphone className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-center overflow-auto bg-[#eef0ee] p-3" style={{ maxHeight: "70vh" }}>
            <iframe
              title="E-Mail-Vorschau"
              srcDoc={previewHtml}
              className="rounded-md border-0 bg-white shadow-sm"
              style={{ width: view === "mobile" ? 380 : 600, height: 900, maxWidth: "100%" }}
            />
          </div>
        </div>

        {/* Aktionsleiste */}
        <div className="mt-3 space-y-3 rounded-lg border bg-card p-4">
          {!ro && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={pending || !dirty} onClick={onSave}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Speichern
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={pending}>
                    <RotateCcw className="size-4" /> Auf Standard zurücksetzen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Auf Standard zurücksetzen?</DialogTitle>
                    <DialogDescription>
                      Alle Felder und das Logo werden auf das ausgelieferte Standard-Design zurückgesetzt. Nicht gespeicherte Änderungen gehen verloren.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline" size="sm">Abbrechen</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button type="button" size="sm" onClick={onReset}>Zurücksetzen</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label className="text-xs">Test-E-Mail an</Label>
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="name@example.com" />
            </div>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onTest}>
              <Send className="size-4" /> Testversand
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Der Testversand nutzt die zuletzt <strong>gespeicherte</strong> Vorlage mit einem Beispiel-Link.
          </p>
        </div>
      </div>
    </div>
  );
}
