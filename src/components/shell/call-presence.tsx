"use client";

import * as React from "react";

/**
 * Setzt den Präsenz-Status auf „Im Call", solange der Anruf-Screen offen ist, und
 * zurück auf „Verfügbar" beim Verlassen. Keine UI.
 */
export function CallPresence() {
  React.useEffect(() => {
    const post = (call: string) =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call }),
        keepalive: true,
      }).catch(() => {});

    post("start");
    return () => {
      post("end");
    };
  }, []);

  return null;
}
