"use client";

import * as React from "react";
import Link from "next/link";

const SPLASH_EVENT = "werkpair:splash";
const DURATION_MS = 3400;
const LOGO_WHITE = "/werkpair-logo-white.png"; // weiß — dunkle Flächen (Sidebar)
const BUNT = "/werkpair-logo.jpeg"; // farbig — finaler Ruhezustand im Splash

const ORANGE = "#F5A623";
const PETROL = "#125A50";

/** Splash-Animation auslösen (z. B. Klick aufs Logo). */
export function triggerSplash() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPLASH_EVENT));
}

interface FlyLetter {
  ch: string;
  color: string;
  dx: number;
  dy: number;
  rot: number;
  delay: number;
}

/**
 * Logo-Reveal: Die acht Buchstaben von WERKPAIR fliegen einzeln aus zufälligen
 * Richtungen herein, rotieren und rasten mit Feder-Easing ein. Danach lösen sie
 * sich sanft in die echte, farbige Wortmarke (mit Schraubenschlüssel/Handschlag)
 * auf. Respektiert prefers-reduced-motion.
 */
function LogoReveal({ onDone }: { onDone: () => void }) {
  const reduce = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const letters = React.useMemo<FlyLetter[]>(() => {
    return "WERKPAIR".split("").map((ch, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 190 + Math.random() * 300;
      return {
        ch,
        color: i < 4 ? ORANGE : PETROL,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: (Math.random() - 0.5) * 680,
        delay: Math.random() * 0.34,
      };
    });
  }, []);

  const [entered, setEntered] = React.useState(reduce);
  const [morph, setMorph] = React.useState(reduce);

  React.useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    const t1 = setTimeout(() => setMorph(true), 1700); // Buchstaben → echtes Logo
    const t2 = setTimeout(onDone, DURATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduce, onDone]);

  function letterStyle(l: FlyLetter): React.CSSProperties {
    const base: React.CSSProperties = {
      display: "inline-block",
      color: l.color,
      willChange: "transform, opacity, filter",
    };
    if (reduce) return { ...base, opacity: 1 };
    if (!entered) {
      return {
        ...base,
        transform: `translate(${l.dx}px, ${l.dy}px) rotate(${l.rot}deg) scale(0.2)`,
        opacity: 0,
        filter: "blur(7px)",
      };
    }
    return {
      ...base,
      transform: "translate(0, 0) rotate(0deg) scale(1)",
      opacity: 1,
      filter: "blur(0)",
      transition:
        `transform 1s cubic-bezier(0.34, 1.56, 0.64, 1) ${l.delay}s,` +
        `opacity 0.55s ease ${l.delay}s,` +
        `filter 0.55s ease ${l.delay}s`,
    };
  }

  return (
    <div className="relative flex flex-col items-center gap-5">
      {/* Akzent-Ring hinter der Karte */}
      {!reduce && (
        <span
          aria-hidden
          className="logofx-ring pointer-events-none absolute top-1/2 left-1/2 -z-10 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ border: "1px solid color-mix(in srgb, var(--primary) 45%, transparent)" }}
        />
      )}

      <div className="logofx-card overflow-visible rounded-2xl bg-white px-12 py-9 shadow-[0_22px_70px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
        <div className="relative grid place-items-center">
          {/* Fliegende Einzelbuchstaben */}
          <div
            className="col-start-1 row-start-1 font-display text-5xl font-extrabold tracking-tight sm:text-6xl"
            style={{
              opacity: morph ? 0 : 1,
              transform: morph ? "scale(1.06)" : "none",
              transition: "opacity 0.5s ease, transform 0.5s ease",
              filter: morph ? "blur(3px)" : "none",
            }}
          >
            {letters.map((l, i) => (
              <span key={i} style={letterStyle(l)}>
                {l.ch}
              </span>
            ))}
          </div>

          {/* Finaler farbiger Ruhezustand: echte Wortmarke mit Werkzeug/Handschlag */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BUNT}
            alt="Werkpair"
            draggable={false}
            className="col-start-1 row-start-1 h-9 w-auto sm:h-10"
            style={{
              opacity: morph ? 1 : 0,
              transform: morph ? "scale(1)" : "scale(0.9)",
              transition:
                "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </div>

      <span
        aria-hidden
        className="logofx-line h-px w-24 rounded-full"
        style={{ backgroundColor: "var(--primary)" }}
      />
      <span className="sr-only">Werkpair</span>
    </div>
  );
}

/**
 * Vollbild-Logo-Reveal. Erscheint (1) nach dem Login über `?welcome=1` und
 * (2) auf das globale Event `werkpair:splash` (Logo-Klick).
 */
export function SplashProvider() {
  const [runId, setRunId] = React.useState(0);
  const [active, setActive] = React.useState(false);

  const play = React.useCallback(() => {
    setRunId((n) => n + 1);
    setActive(true);
  }, []);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") === "1") {
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      play();
    }
    window.addEventListener(SPLASH_EVENT, play);
    return () => window.removeEventListener(SPLASH_EVENT, play);
  }, [play]);

  if (!active) return null;

  return (
    <div
      key={runId}
      role="presentation"
      onClick={() => setActive(false)}
      className="logofx-overlay fixed inset-0 z-[120] flex items-center justify-center bg-background"
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 60%)",
      }}
    >
      <LogoReveal key={runId} onDone={() => setActive(false)} />
    </div>
  );
}

/**
 * Logo-Link für die Sidebar: navigiert nach „/" UND spielt den Logo-Reveal ab.
 */
export function SidebarLogo() {
  return (
    <Link
      href="/"
      onClick={() => triggerSplash()}
      className="group flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4"
    >
      {/* Weiße Wortmarke direkt auf der Sidebar — kein Kasten, nahtlos. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_WHITE}
        alt="Werkpair"
        className="h-5 w-auto origin-left transition-transform group-hover:scale-[1.03] group-active:scale-95"
        draggable={false}
      />
      <span className="mt-0.5 rounded bg-sidebar-accent px-1 py-0.5 text-[9px] font-semibold tracking-wider text-sidebar-foreground/80">
        ADMIN
      </span>
    </Link>
  );
}
