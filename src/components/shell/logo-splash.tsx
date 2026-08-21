"use client";

import * as React from "react";
import Link from "next/link";

const SPLASH_EVENT = "porta:splash";
const DURATION_MS = 1900;

/** Splash-Animation auslösen (z. B. Klick aufs Logo). */
export function triggerSplash() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPLASH_EVENT));
}

/**
 * Vollbild-Logo-Splash. Erscheint (1) nach dem Login über `?welcome=1` und
 * (2) auf das globale Event `porta:splash` (Logo-Klick). Läuft rein über CSS
 * (globals.css) und entfernt sich nach der Timeline selbst.
 */
export function SplashProvider() {
  const [runId, setRunId] = React.useState(0);
  const [active, setActive] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = React.useCallback(() => {
    setRunId((n) => n + 1); // Neustart der CSS-Animation erzwingen
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), DURATION_MS);
  }, []);

  React.useEffect(() => {
    // Nach Login: ?welcome=1 → einmal abspielen und Param entfernen.
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "1") {
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      play();
    }
    window.addEventListener(SPLASH_EVENT, play);
    return () => {
      window.removeEventListener(SPLASH_EVENT, play);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [play]);

  if (!active) return null;

  return (
    <div
      key={runId}
      role="presentation"
      onClick={() => setActive(false)}
      className="splash-overlay fixed inset-0 z-[120] flex items-center justify-center bg-background"
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, var(--primary) 6%, transparent), transparent 60%)",
      }}
    >
      <div className="splash-card relative flex flex-col items-center gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-white px-9 py-7 shadow-[0_18px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/porta-werk-logo.jpg"
            alt="Porta Werk"
            className="h-10 w-auto select-none"
            draggable={false}
          />
          <span
            aria-hidden
            className="splash-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
            style={{
              background:
                "linear-gradient(100deg, transparent, rgba(255,255,255,0.85), transparent)",
            }}
          />
        </div>
        <span
          aria-hidden
          className="splash-line h-px w-24 origin-left rounded-full"
          style={{ backgroundColor: "var(--primary)" }}
        />
      </div>
    </div>
  );
}

/**
 * Logo-Link für die Sidebar: navigiert nach „/" UND spielt die Splash-
 * Animation ab (ohne die Navigation zu blockieren).
 */
export function SidebarLogo() {
  return (
    <Link
      href="/"
      onClick={() => triggerSplash()}
      className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4"
    >
      <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 shadow-sm transition-transform hover:scale-[1.03] active:scale-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/porta-werk-logo.jpg"
          alt="Porta Werk"
          className="h-5 w-auto"
          draggable={false}
        />
      </span>
      <span className="rounded bg-sidebar-accent px-1 py-0.5 text-[9px] font-semibold tracking-wider text-sidebar-foreground">
        ADMIN
      </span>
    </Link>
  );
}
