"use client";

import * as React from "react";
import { clearStaleSessionAction } from "./actions";

/** Räumt ein vorhandenes, aber ungültiges Session-Cookie beim Laden weg. */
export function ClearStaleCookie() {
  React.useEffect(() => {
    void clearStaleSessionAction();
  }, []);
  return null;
}
