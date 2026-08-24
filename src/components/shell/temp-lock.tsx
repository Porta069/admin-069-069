"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Lock, Unlock } from "lucide-react";

const ORANGE = "#F5A623";

/**
 * Temp-Lock: eine moderne, animierte „Screensaver"-Sperre (Datenschutz beim
 * kurzen Weggehen). Kein echtes Sicherheits-Gate — mit „Entsperren" oder Esc
 * schließbar. Zeigt Live-Uhr, Logo und Slogan auf animiertem Hintergrund.
 */
export function TempLock({ userName }: { userName?: string }) {
  const [locked, setLocked] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!locked) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLocked(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [locked]);

  const zeit = now
    ? now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const datum = now
    ? now.toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setLocked(true)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        aria-label="Bildschirm sperren (Temp-Lock)"
        title="Temp-Lock — Bildschirm vorübergehend sperren"
      >
        <Lock className="size-3.5" />
        <span className="hidden sm:inline">Temp-Lock</span>
      </button>

      {mounted &&
        locked &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-hidden"
            style={{
              background:
                "radial-gradient(140% 120% at 50% 0%, #1c2b28 0%, #0d0b0a 70%)",
            }}
          >
            {/* Driftende Farb-Blobs */}
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
            {/* Feine Textur + Vignette für Tiefe */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.85) 0.5px, transparent 0.5px)",
                backgroundSize: "3px 3px",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 45%, rgba(0,0,0,0.62))" }}
            />

            <div className="relative flex h-full flex-col items-center justify-center gap-9 px-6 text-center">
              {/* Live-Uhr */}
              <div className="templock-in" style={{ animationDelay: "0.05s" }}>
                <div className="font-display text-7xl font-semibold tracking-tight text-white tabular sm:text-8xl">
                  {zeit}
                </div>
                <div className="mt-1 text-sm text-white/50 capitalize">{datum}</div>
              </div>

              {/* Logo + Slogan */}
              <div
                className="templock-in flex flex-col items-center gap-4"
                style={{ animationDelay: "0.18s" }}
              >
                <div className="templock-float relative">
                  <span
                    aria-hidden
                    className="templock-glow absolute inset-0 -z-10 blur-2xl"
                    style={{ background: "radial-gradient(circle, rgba(245,166,35,0.4), transparent 70%)" }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/werkpair-logo-white.png"
                    alt="Werkpair"
                    className="h-8 w-auto sm:h-10"
                    draggable={false}
                  />
                </div>
                <p className="max-w-md font-display text-lg font-medium text-white/90 sm:text-xl">
                  Ab jetzt <span style={{ color: ORANGE }}>bewirbt</span> sich das
                  Handwerk bei <span style={{ color: ORANGE }}>DIR</span>!
                </p>
              </div>

              {/* Entsperren */}
              <button
                type="button"
                onClick={() => setLocked(false)}
                className="templock-in group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
                style={{ animationDelay: "0.32s" }}
              >
                <Unlock className="size-4 transition-transform group-hover:-translate-y-0.5" />
                Entsperren
              </button>

              <p
                className="templock-in absolute bottom-8 text-xs text-white/40"
                style={{ animationDelay: "0.42s" }}
              >
                {userName ? `Angemeldet als ${userName} · ` : ""}Esc zum Entsperren
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
