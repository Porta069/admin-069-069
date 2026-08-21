"use client";

import * as React from "react";
import Link from "next/link";

const SPLASH_EVENT = "porta:splash";
const DURATION_MS = 2400;
const LOGO = "/porta-werk-logo.jpg";

/** Splash-Animation auslösen (z. B. Klick aufs Logo). */
export function triggerSplash() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SPLASH_EVENT));
}

// ── Varianten ────────────────────────────────────────────────────────────────
// Jede Variante zerlegt das Logo in ein Raster und animiert die Kacheln aus
// einem Startzustand an ihren Platz. Das Endbild ist immer pixelgleich.
type Variant = "shatter" | "blinds" | "columns" | "depth" | "wipe";
const VARIANTS: Variant[] = ["shatter", "blinds", "columns", "depth", "wipe"];
const GRID: Record<Variant, { cols: number; rows: number; perspective: boolean }> = {
  shatter: { cols: 6, rows: 3, perspective: false },
  blinds: { cols: 1, rows: 5, perspective: true },
  columns: { cols: 7, rows: 1, perspective: false },
  depth: { cols: 5, rows: 2, perspective: false },
  wipe: { cols: 6, rows: 3, perspective: false },
};

interface Tile {
  col: number;
  row: number;
  cols: number;
  rows: number;
  start: string; // transform im Startzustand
  delay: number; // Sekunden
  origin?: string;
}

function buildTiles(variant: Variant): Tile[] {
  const { cols, rows } = GRID[variant];
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.hypot(dx, dy);
      let start = "none";
      let delay = 0;
      let origin: string | undefined;
      switch (variant) {
        case "shatter":
          start = `translate(${dx * 16 + (Math.random() - 0.5) * 26}px, ${
            dy * 16 + (Math.random() - 0.5) * 26
          }px) rotate(${(Math.random() - 0.5) * 34}deg) scale(0.4)`;
          delay = dist * 0.05 + Math.random() * 0.05;
          break;
        case "blinds":
          start = "rotateX(87deg)";
          origin = "center";
          delay = row * 0.09;
          break;
        case "columns":
          start = "translateY(36px)";
          delay = col * 0.06;
          break;
        case "depth":
          start = "scale(0.18)";
          delay = dist * 0.07;
          break;
        case "wipe":
          start = "translateX(14px) scale(1.1)";
          delay = (col + row) * 0.05;
          break;
      }
      tiles.push({ col, row, cols, rows, start, delay, origin });
    }
  }
  return tiles;
}

function LogoReveal({ onDone }: { onDone: () => void }) {
  const plan = React.useMemo(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
    return { variant, tiles: buildTiles(variant), reduce: Boolean(reduce) };
  }, []);
  const [entered, setEntered] = React.useState(plan.reduce); // reduce → sofort fertig

  React.useEffect(() => {
    if (!plan.reduce) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      const done = setTimeout(onDone, DURATION_MS);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(done);
      };
    }
    const done = setTimeout(onDone, 1100);
    return () => clearTimeout(done);
  }, [plan.reduce, onDone]);

  const { perspective } = GRID[plan.variant];

  function tileStyle(t: Tile): React.CSSProperties {
    const bg: React.CSSProperties = {
      backgroundImage: `url(${LOGO})`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${t.cols * 100}% ${t.rows * 100}%`,
      backgroundPosition: `${t.cols > 1 ? (t.col / (t.cols - 1)) * 100 : 0}% ${
        t.rows > 1 ? (t.row / (t.rows - 1)) * 100 : 0
      }%`,
      transformOrigin: t.origin,
      transformStyle: perspective ? "preserve-3d" : undefined,
      backfaceVisibility: perspective ? "hidden" : undefined,
    };
    if (plan.reduce) return { ...bg, transform: "none", opacity: 1 };
    if (!entered) {
      return { ...bg, transform: t.start, opacity: 0, transition: "none", willChange: "transform, opacity" };
    }
    return {
      ...bg,
      transform: "none",
      opacity: 1,
      willChange: "transform, opacity",
      transition:
        `transform 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${t.delay}s,` +
        `opacity 0.55s ease ${t.delay}s`,
    };
  }

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Akzent-Ring hinter der Karte */}
      {!plan.reduce && (
        <span
          aria-hidden
          className="logofx-ring pointer-events-none absolute top-1/2 left-1/2 -z-10 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ border: "1px solid color-mix(in srgb, var(--primary) 55%, transparent)" }}
        />
      )}

      <div className="logofx-card overflow-hidden rounded-2xl bg-white px-9 py-7 shadow-[0_22px_70px_-18px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
        <div className="relative inline-block" style={perspective ? { perspective: "700px" } : undefined}>
          {/* Unsichtbares Logo bestimmt die Box-Maße (echtes Seitenverhältnis). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Porta Werk" className="block h-11 w-auto opacity-0" draggable={false} />
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${GRID[plan.variant].cols}, 1fr)`,
              gridTemplateRows: `repeat(${GRID[plan.variant].rows}, 1fr)`,
            }}
          >
            {plan.tiles.map((t, i) => (
              <span key={i} aria-hidden style={tileStyle(t)} />
            ))}
          </div>
        </div>
      </div>

      <span
        aria-hidden
        className="logofx-line h-px w-24 rounded-full"
        style={{ backgroundColor: "var(--primary)" }}
      />
      <span className="sr-only">Porta Werk</span>
    </div>
  );
}

/**
 * Vollbild-Logo-Reveal. Erscheint (1) nach dem Login über `?welcome=1` und
 * (2) auf das globale Event `porta:splash` (Logo-Klick). Bei jedem Trigger wird
 * zufällig eine andere Aufbau-Variante gewählt.
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
      className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4"
    >
      <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 shadow-sm transition-transform hover:scale-[1.03] active:scale-95">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Porta Werk" className="h-5 w-auto" draggable={false} />
      </span>
      <span className="rounded bg-sidebar-accent px-1 py-0.5 text-[9px] font-semibold tracking-wider text-sidebar-foreground">
        ADMIN
      </span>
    </Link>
  );
}
