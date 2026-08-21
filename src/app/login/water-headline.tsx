"use client";

import * as React from "react";

/**
 * Wortmarke „PORTA WERK", deren Buchstaben beim ERSTEN Besuch pro Tag flüssig
 * wie Wasser zusammengleiten: aus verstreutem, weichem, halbtransparentem
 * Zustand fließen sie (über einen SVG-Gooey-Filter tropfenartig verbunden) an
 * ihren Platz und rasten scharf ein.
 *
 * Gate: localStorage-Tagesschlüssel `pw_login_intro = YYYY-MM-DD`. Gleicher Tag
 * → sofort finaler Zustand. `prefers-reduced-motion` → kein Intro. Kein
 * Layout-Flash: SSR/erster Render = Endzustand; die Streuung wird per
 * useLayoutEffect VOR dem ersten Paint gesetzt. Zufalls-Offsets nur clientseitig
 * → keine Hydration-Mismatch.
 */

const WORD = "PORTA WERK";
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type Phase = "rest" | "scatter" | "settle";
type Offset = { x: number; y: number; r: number; s: number };

export function WaterHeadline() {
  const chars = React.useMemo(() => WORD.split(""), []);
  const [phase, setPhase] = React.useState<Phase>("rest");
  const [offsets, setOffsets] = React.useState<Offset[] | null>(null);

  useIsoLayoutEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let seen: string | null = null;
    try {
      seen = localStorage.getItem("pw_login_intro");
    } catch {
      /* localStorage blockiert → einfach kein Intro */
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen === today || reduce) return; // Endzustand beibehalten

    try {
      localStorage.setItem("pw_login_intro", today);
    } catch {
      /* ignore */
    }

    const offs: Offset[] = chars.map(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 130;
      return {
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist * 0.5 + (Math.random() - 0.5) * 70,
        r: (Math.random() - 0.5) * 44,
        s: 0.55 + Math.random() * 0.3,
      };
    });
    setOffsets(offs);
    setPhase("scatter");

    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("settle"));
    });
    // Nach dem Einrasten Filter/Transform entfernen → gestochen scharfer Text.
    const done = setTimeout(() => setPhase("rest"), 2600);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(done);
    };
  }, [chars]);

  const animating = phase !== "rest" && offsets !== null;

  function letterStyle(i: number): React.CSSProperties {
    const base: React.CSSProperties = {
      display: "inline-block",
      willChange: "transform, opacity, filter",
    };
    if (!animating) return { ...base };
    const o = offsets![i];
    if (phase === "scatter") {
      return {
        ...base,
        transform: `translate(${o.x}px, ${o.y}px) rotate(${o.r}deg) scale(${o.s})`,
        opacity: 0.12,
        filter: "blur(7px)",
        transition: "none",
      };
    }
    // settle
    const delay = i * 0.05;
    return {
      ...base,
      transform: "translate(0,0) rotate(0deg) scale(1)",
      opacity: 1,
      filter: "blur(0px)",
      transition:
        `transform 1.15s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s,` +
        `opacity 0.9s ease ${delay}s,` +
        `filter 1s ease ${delay}s`,
    };
  }

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
        aria-label="Porta Werk"
        className={animating ? "" : "water-buoy"}
        style={{
          fontFamily: "var(--font-display)",
          filter: animating ? "url(#water-goo)" : "none",
          margin: 0,
        }}
      >
        <span className="sr-only">Porta Werk</span>
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
