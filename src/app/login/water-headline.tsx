"use client";

import * as React from "react";

/**
 * Wortmarke „WERKPAIR", deren Buchstaben beim ERSTEN Besuch pro Tag flüssig
 * wie Wasser zusammengleiten: aus verstreutem, halbtransparentem Zustand fließen
 * sie (über einen SVG-Gooey-Filter tropfenartig verbunden) an ihren Platz und
 * rasten scharf ein.
 *
 * Performance: pro Buchstabe animieren ausschließlich `transform` + `opacity`
 * (reine Compositor-Arbeit, kein Layout/Paint). Der weiche „Wasser"-Blur läuft
 * EINMAL auf dem Container-Filter (nicht pro Buchstabe) — so bleibt die Animation
 * auch auf schwächerer Hardware ruckelfrei.
 *
 * Gate: localStorage-Tagesschlüssel `pw_login_intro = YYYY-MM-DD` (lokaler Tag).
 * Gleicher Tag → sofort finaler Zustand. `prefers-reduced-motion` → kein Intro.
 * Kein Layout-Flash: SSR/erster Render = Endzustand; die Streuung wird per
 * useLayoutEffect VOR dem ersten Paint gesetzt. Zufalls-Offsets nur clientseitig
 * → keine Hydration-Mismatch.
 */

const WORD = "WERKPAIR";
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type Phase = "rest" | "scatter" | "settle";
type Offset = { x: number; y: number; r: number; s: number; d: number };

function localDayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function WaterHeadline() {
  const chars = React.useMemo(() => WORD.split(""), []);
  const [phase, setPhase] = React.useState<Phase>("rest");
  const [offsets, setOffsets] = React.useState<Offset[] | null>(null);

  useIsoLayoutEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem("pw_login_intro");
    } catch {
      return; // localStorage blockiert → kein Intro
    }
    const today = localDayKey();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen === today || reduce) return; // Endzustand beibehalten

    try {
      localStorage.setItem("pw_login_intro", today);
    } catch {
      /* ignore */
    }

    const offs: Offset[] = chars.map(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 120;
      return {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist * 0.45 + (Math.random() - 0.5) * 60,
        r: (Math.random() - 0.5) * 40,
        s: 0.55 + Math.random() * 0.3,
        d: Math.random() * 0.12, // organischer Delay-Jitter
      };
    });
    setOffsets(offs);
    setPhase("scatter");

    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("settle"));
    });
    // Nach dem Einrasten Filter/Transform/will-change entfernen → scharfer Text.
    const done = setTimeout(() => setPhase("rest"), 2400);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(done);
    };
  }, [chars]);

  const animating = phase !== "rest" && offsets !== null;

  function letterStyle(i: number): React.CSSProperties {
    if (!animating) return { display: "inline-block" };
    const o = offsets![i];
    if (phase === "scatter") {
      return {
        display: "inline-block",
        willChange: "transform, opacity",
        transform: `translate(${o.x}px, ${o.y}px) rotate(${o.r}deg) scale(${o.s})`,
        opacity: 0.1,
        transition: "none",
      };
    }
    // settle — nur transform + opacity (Compositor), flüssiges expo-out-Ausklingen
    const delay = i * 0.045 + o.d;
    return {
      display: "inline-block",
      willChange: "transform, opacity",
      transform: "translate(0, 0) rotate(0deg) scale(1)",
      opacity: 1,
      transition:
        `transform 1.25s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s,` +
        `opacity 0.85s ease ${delay}s`,
    };
  }

  // Der weiche „Wasser"-Blur EINMAL global auf dem Container:
  const containerFilter =
    phase === "scatter"
      ? "url(#water-goo) blur(4px)"
      : phase === "settle"
        ? "url(#water-goo) blur(0px)"
        : "none";
  const containerTransition = phase === "settle" ? "filter 1.1s ease" : "none";

  return (
    <div className="relative flex justify-center">
      {/* Gooey-Filter: verschmilzt überlappende Buchstaben beim Zusammenfließen. */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id="water-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
            />
          </filter>
        </defs>
      </svg>

      <h1
        aria-label="Werkpair"
        className={animating ? "" : "water-buoy"}
        style={{
          fontFamily: "var(--font-display)",
          filter: containerFilter,
          transition: containerTransition,
          margin: 0,
        }}
      >
        <span className="sr-only">Werkpair</span>
        <span
          aria-hidden
          className="flex select-none items-center justify-center text-[clamp(2rem,9vw,3.25rem)] leading-none font-semibold tracking-[0.06em] text-[#fafaf9]"
          style={{ textShadow: "0 1px 0 rgba(232,89,12,0.25), 0 8px 30px rgba(232,89,12,0.15)" }}
        >
          {chars.map((c, i) =>
            c === " " ? (
              <span key={i} aria-hidden style={{ width: "0.4em" }} />
            ) : (
              <span key={i} aria-hidden style={letterStyle(i)}>
                {c}
              </span>
            ),
          )}
        </span>
      </h1>
    </div>
  );
}
