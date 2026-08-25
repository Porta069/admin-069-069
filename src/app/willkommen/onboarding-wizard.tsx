"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  ShieldCheck,
  Smartphone,
  Check,
  Copy,
  Loader2,
  Send,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BellRing,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  startTotpSetupAction,
  confirmTotpAction,
  enableNtfyAction,
  sendeNtfyTestAction,
} from "@/app/(app)/konto/actions";
import { finishOnboardingAndGoHome } from "./actions";

interface Props {
  name: string;
  twoFactorAktiv: boolean;
  ntfyTopic: string | null;
  ntfyServer: string;
}

const SCHRITTE = ["Start", "Zwei-Faktor", "Benachrichtigungen", "Fertig"];

export function OnboardingWizard({ name, twoFactorAktiv, ntfyTopic, ntfyServer }: Props) {
  const [step, setStep] = React.useState(0);
  const [zweiFaktorFertig, setZweiFaktorFertig] = React.useState(twoFactorAktiv);
  const [topic, setTopic] = React.useState<string | null>(ntfyTopic);

  return (
    <div className="w-full max-w-xl">
      {/* Fortschritt */}
      <div className="mb-6 flex items-center gap-2">
        {SCHRITTE.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  i < step
                    ? "bg-success text-white"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
            </div>
            {i < SCHRITTE.length - 1 && (
              <span className={cn("h-px flex-1", i < step ? "bg-success" : "bg-border")} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {step === 0 && <StartSchritt name={name} onNext={() => setStep(1)} />}
        {step === 1 && (
          <ZweiFaktorSchritt
            fertig={zweiFaktorFertig}
            onFertig={() => setZweiFaktorFertig(true)}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <BenachrichtigungenSchritt
            topic={topic}
            server={ntfyServer}
            onTopic={setTopic}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && <FertigSchritt onBack={() => setStep(2)} />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Schritt 0 */

function StartSchritt({ name, onNext }: { name: string; onNext: () => void }) {
  const vorname = name.split(" ")[0] || name;
  return (
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-8" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">Willkommen, {vorname}!</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Richten wir dein Konto in zwei kurzen Schritten ein: die
        <span className="font-medium text-foreground"> Zwei-Faktor-Authentifizierung</span> für
        maximale Sicherheit und die
        <span className="font-medium text-foreground"> Handy-Benachrichtigungen</span>. Beides
        lässt sich direkt testen.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Merkmal icon={ShieldCheck} title="Zwei-Faktor" text="Schützt dein Login mit einem Einmal-Code." />
        <Merkmal icon={Smartphone} title="Handy-Push" text="Wichtiges direkt aufs Handy." />
      </div>
      <Button className="mt-6 w-full" onClick={onNext}>
        Los geht’s <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function Merkmal({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-left">
      <Icon className="size-5 text-primary" />
      <p className="mt-1.5 text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

/* --------------------------------------------------------------- Schritt 1 */

function ZweiFaktorSchritt({
  fertig,
  onFertig,
  onNext,
  onBack,
}: {
  fertig: boolean;
  onFertig: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [laden, setLaden] = React.useState(false);
  const [pruefen, setPruefen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (fertig || qr) return;
    setLaden(true);
    startTotpSetupAction()
      .then((res) => {
        if (res.ok) {
          setQr(res.qrDataUrl);
          setSecret(res.secret);
        } else toast.error(res.message);
      })
      .finally(() => setLaden(false));
  }, [fertig, qr]);

  const bestaetigen = async () => {
    if (code.trim().length < 6) return;
    setPruefen(true);
    const res = await confirmTotpAction(code.trim());
    setPruefen(false);
    if (res.ok) {
      toast.success("Zwei-Faktor aktiv — dein Login ist jetzt geschützt. ✅");
      onFertig();
    } else {
      toast.error(res.message);
      setCode("");
    }
  };

  return (
    <div>
      <SchrittKopf
        icon={ShieldCheck}
        titel="Zwei-Faktor-Authentifizierung"
        text="Schütze dein Konto mit einem zeitbasierten Einmal-Code (TOTP)."
      />

      {fertig ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success-soft p-6 text-center text-success">
          <Check className="size-8" />
          <p className="font-medium">Zwei-Faktor ist aktiv.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2.5">
              <Stepnum n={1} />
              <div>
                <p className="font-medium">Authenticator-App installieren</p>
                <p className="text-xs text-muted-foreground">
                  z. B. Google Authenticator, Microsoft Authenticator oder Authy.
                </p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <Stepnum n={2} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">QR-Code scannen</p>
                <div className="mt-2 flex flex-col items-center gap-3 rounded-lg border bg-background p-4">
                  {laden || !qr ? (
                    <div className="flex size-[180px] items-center justify-center">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="2FA-QR-Code" width={180} height={180} className="rounded" />
                  )}
                  {secret && (
                    <div className="w-full">
                      <p className="mb-1 text-center text-xs text-muted-foreground">
                        Oder Schlüssel manuell eingeben:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 text-center font-mono text-xs">
                          {secret}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={async () => {
                            await navigator.clipboard.writeText(secret);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                          aria-label="Schlüssel kopieren"
                        >
                          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
            <li className="flex gap-2.5">
              <Stepnum n={3} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Code aus der App eingeben (Test)</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Der 6-stellige Code bestätigt, dass alles funktioniert.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && bestaetigen()}
                    inputMode="numeric"
                    placeholder="123456"
                    className="text-center font-mono text-lg tracking-[0.3em]"
                  />
                  <Button onClick={bestaetigen} disabled={pruefen || code.length < 6}>
                    {pruefen ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Prüfen
                  </Button>
                </div>
              </div>
            </li>
          </ol>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        <Button onClick={onNext} disabled={!fertig}>
          Weiter <ArrowRight className="size-4" />
        </Button>
      </div>
      {!fertig && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Zwei-Faktor ist Pflicht — bitte oben abschließen, um fortzufahren.
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Schritt 2 */

function BenachrichtigungenSchritt({
  topic,
  server,
  onTopic,
  onNext,
  onBack,
}: {
  topic: string | null;
  server: string;
  onTopic: (t: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const subscribeUrl = topic ? `${server}/${topic}` : "";

  const copy = async (val: string, key: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <SchrittKopf
        icon={Smartphone}
        titel="Handy-Benachrichtigungen"
        text="Erhalte neue Registrierungen, Chat-Nachrichten & mehr direkt aufs Handy — über die kostenlose ntfy-App."
      />

      {!topic ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Aktiviere die Benachrichtigungen — wir erzeugen einen privaten,
            geheimen Kanal für dich.
          </p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const res = await enableNtfyAction();
              setPending(false);
              if (res.ok) {
                onTopic(res.topic);
                toast.success("Aktiviert — jetzt die App verbinden.");
              } else toast.error(res.message);
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
            Handy-Benachrichtigungen aktivieren
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Optional — du kannst diesen Schritt auch überspringen.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2.5">
              <Stepnum n={1} />
              <div>
                <p className="font-medium">ntfy-App installieren</p>
                <p className="text-xs text-muted-foreground">
                  iPhone: App Store · Android: Google Play / F-Droid — „ntfy" suchen.
                </p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <Stepnum n={2} />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium">In der App „+ Subscribe to topic" öffnen</p>
                <CopyFeld label="Topic-Name" value={topic} copied={copied === "t"} onCopy={() => copy(topic, "t")} />
                <p className="text-xs text-muted-foreground">Oder am Handy diesen Link öffnen:</p>
                <CopyFeld label="Direkt-Link" value={subscribeUrl} copied={copied === "u"} onCopy={() => copy(subscribeUrl, "u")} />
              </div>
            </li>
            <li className="flex gap-2.5">
              <Stepnum n={3} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Benachrichtigungen erlauben & testen</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Der Test-Push sollte in wenigen Sekunden auf dem Handy erscheinen.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testing}
                  onClick={async () => {
                    setTesting(true);
                    const res = await sendeNtfyTestAction();
                    setTesting(false);
                    if (res.ok) toast.success("Test gesendet — schau auf dein Handy 📱");
                    else toast.error(res.message);
                  }}
                >
                  {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Test-Push senden
                </Button>
              </div>
            </li>
          </ol>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        <Button onClick={onNext} variant={topic ? "default" : "outline"}>
          {topic ? "Weiter" : "Überspringen"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Schritt 3 */

function FertigSchritt({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-success-soft text-success">
        <PartyPopper className="size-8" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold">Alles bereit!</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Dein Konto ist eingerichtet. Du kannst Zwei-Faktor und Benachrichtigungen
        jederzeit unter <span className="font-medium text-foreground">Mein Konto</span> ändern.
      </p>
      <form action={finishOnboardingAndGoHome} className="mt-6">
        <FertigButton />
      </form>
      <Button variant="ghost" size="sm" className="mt-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> Zurück
      </Button>
    </div>
  );
}

function FertigButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      Zum Dashboard
    </Button>
  );
}

/* ------------------------------------------------------------------ Helfer */

function SchrittKopf({
  icon: Icon,
  titel,
  text,
}: {
  icon: typeof ShieldCheck;
  titel: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold">{titel}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Stepnum({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold text-muted-foreground">
      {n}
    </span>
  );
}

function CopyFeld({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={onCopy}
          aria-label={`${label} kopieren`}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
