"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ORANGE = "#F5A623";
const CODE = "2026"; // Entsperr-Code — gilt für jeden Mitarbeiter-Account.
const STORAGE_KEY = "werkpair-templock"; // Wert: "manual" | "auto"
const INACTIVITY_MS = 15 * 60 * 1000; // 15 Minuten
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

/**
 * Temp-Lock: animierte „Screensaver"-Sperre mit Code-Eingabe (2026). Sperrt auch
 * automatisch nach 15 Minuten Inaktivität. Kehrt der Mitarbeiter nach einer
 * AUTO-Sperre zurück, erscheint ein kleiner Datenschutz-Hinweis, den Temp-Lock
 * künftig selbst zu aktivieren. Übersteht Reload (sessionStorage).
 */
export function TempLock({ userName }: { userName?: string }) {
  const [locked, setLocked] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);
  const [digits, setDigits] = React.useState<string[]>(["", "", "", ""]);
  const [wrong, setWrong] = React.useState(false);
  const [reminder, setReminder] = React.useState(false);
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);

  const sperren = React.useCallback((auto: boolean) => {
    setDigits(["", "", "", ""]);
    setWrong(false);
    sessionStorage.setItem(STORAGE_KEY, auto ? "auto" : "manual");
    setLocked(true);
  }, []);

  const entsperren = React.useCallback(() => {
    const warAuto = sessionStorage.getItem(STORAGE_KEY) === "auto";
    sessionStorage.removeItem(STORAGE_KEY);
    setLocked(false);
    if (warAuto) setReminder(true); // Datenschutz-Hinweis nach Auto-Sperre
  }, []);

  React.useEffect(() => {
    setMounted(true);
    const v = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (v) setLocked(true);
  }, []);

  // Inaktivitäts-Timer: nur wenn NICHT gesperrt. Aktivität setzt ihn zurück.
  React.useEffect(() => {
    if (locked) return;
    let timer: ReturnType<typeof setTimeout>;
    let last = 0;
    const reset = () => {
      const t = Date.now();
      if (t - last < 1000) return; // leichtes Throttling
      last = t;
      clearTimeout(timer);
      timer = setTimeout(() => sperren(true), INACTIVITY_MS);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [locked, sperren]);

  const pruefen = React.useCallback(
    (code: string) => {
      if (code === CODE) {
        entsperren();
      } else {
        setWrong(true);
        setTimeout(() => {
          setDigits(["", "", "", ""]);
          setWrong(false);
          inputs.current[0]?.focus();
        }, 450);
      }
    },
    [entsperren],
  );

  React.useEffect(() => {
    if (!locked) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = setTimeout(() => inputs.current[0]?.focus(), 150);
    return () => {
      clearInterval(id);
      clearTimeout(f);
      document.body.style.overflow = prevOverflow;
    };
  }, [locked]);

  const onDigit = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      if (v && i < 3) inputs.current[i + 1]?.focus();
      const code = next.join("");
      if (code.length === 4 && next.every(Boolean)) setTimeout(() => pruefen(code), 0);
      return next;
    });
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    else if (e.key === "Enter") pruefen(digits.join(""));
  };

  const zeit = now
    ? now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const datum = now
    ? now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => sperren(false)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        aria-label="Bildschirm sperren (Temp-Lock)"
        title="Temp-Lock — Bildschirm sperren (Code zum Entsperren)"
      >
        <Lock className="size-3.5" />
        <span className="hidden sm:inline">Temp-Lock</span>
      </button>

      {/* Datenschutz-Hinweis nach automatischer Sperre */}
      <Dialog open={reminder} onOpenChange={setReminder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Datenschutz-Hinweis
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dein Bildschirm wurde nach 15 Minuten Inaktivität automatisch gesperrt.
            Bitte aktiviere den <span className="font-medium text-foreground">Temp-Lock</span> in
            Zukunft selbst, sobald du deinen Platz verlässt — so erfüllen wir die
            Datenschutzbestimmungen und schützen sensible Daten vor fremdem Einblick.
          </p>
          <DialogFooter>
            <Button onClick={() => setReminder(false)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mounted &&
        locked &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-hidden"
            style={{ background: "radial-gradient(140% 120% at 50% 0%, #1c2b28 0%, #0d0b0a 70%)" }}
          >
            <div
              aria-hidden
              className="templock-blob1 pointer-events-none absolute -top-[10vh] -left-[10vw] size-[46vw] rounded-full blur-[60px]"
              style={{ background: "radial-gradient(circle, rgba(245,166,35,0.28), transparent 62%)" }}
            />
            <div
              aria-hidden
              className="templock-blob2 pointer-events-none absolute -right-[8vw] -bottom-[12vh] size-[42vw] rounded-full blur-[70px]"
              style={{ background: "radial-gradient(circle, rgba(18,90,80,0.45), transparent 60%)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
                backgroundSize: "3px 3px",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 45%, rgba(0,0,0,0.62))" }}
            />

            <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6 text-center">
              <div className="templock-in" style={{ animationDelay: "0.05s" }}>
                <div className="font-display text-7xl font-semibold tracking-tight text-white tabular sm:text-8xl">
                  {zeit}
                </div>
                <div className="mt-1 text-sm text-white/50 capitalize">{datum}</div>
              </div>

              <div className="templock-in flex flex-col items-center gap-3" style={{ animationDelay: "0.18s" }}>
                <div className="templock-float relative">
                  <span
                    aria-hidden
                    className="templock-glow absolute inset-0 -z-10 blur-2xl"
                    style={{ background: "radial-gradient(circle, rgba(245,166,35,0.4), transparent 70%)" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/werkpair-logo-white.png" alt="Werkpair" className="h-8 w-auto sm:h-9" draggable={false} />
                </div>
                <p className="max-w-md font-display text-base font-medium text-white/90 sm:text-lg">
                  Ab jetzt <span style={{ color: ORANGE }}>bewirbt</span> sich das Handwerk bei{" "}
                  <span style={{ color: ORANGE }}>DIR</span>!
                </p>
              </div>

              <div className="templock-in flex flex-col items-center gap-3" style={{ animationDelay: "0.3s" }}>
                <p className="text-xs tracking-wide text-white/50 uppercase">Code eingeben zum Entsperren</p>
                <div className={`flex gap-2.5 ${wrong ? "templock-shake" : ""}`}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      value={d}
                      onChange={(e) => onDigit(i, e.target.value)}
                      onKeyDown={(e) => onKey(i, e)}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={1}
                      aria-label={`Ziffer ${i + 1}`}
                      className={`size-14 rounded-xl border bg-white/5 text-center font-display text-2xl font-semibold text-white outline-none backdrop-blur-md transition-colors ${
                        wrong ? "border-destructive" : "border-white/15 focus:border-[color:var(--primary)]"
                      }`}
                    />
                  ))}
                </div>
                {wrong && <p className="text-xs text-destructive">Falscher Code — bitte erneut.</p>}
              </div>

              <p className="templock-in absolute bottom-8 text-xs text-white/40" style={{ animationDelay: "0.42s" }}>
                {userName ? `Gesperrt · ${userName}` : "Gesperrt"}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
