"use client";

import * as React from "react";

/**
 * Hält den angemeldeten Mitarbeiter „online": pingt /api/presence beim Laden und
 * danach periodisch. Ohne Heartbeat läuft der Online-Status von selbst ab
 * (Ableitung aus last_seen_at). Rein Fire-and-forget, keine UI.
 */
export function PresenceHeartbeat({ intervalMs = 60000 }: { intervalMs?: number }) {
  React.useEffect(() => {
    let abbruch = false;
    const ping = () => {
      if (abbruch) return;
      if (typeof document !== "undefined" && document.hidden) return; // Tab im Hintergrund
      fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, intervalMs);
    const onVisible = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      abbruch = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return null;
}
