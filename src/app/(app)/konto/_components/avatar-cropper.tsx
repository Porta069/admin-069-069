"use client";

import * as React from "react";
import { Loader2, ZoomIn, Minus, Plus, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VIEW = 264; // Kantenlänge des (kreisförmigen) Zuschnitt-Fensters in px
const ZIEL = 512; // gespeicherte Ziel-Kantenlänge
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

/**
 * Profilbild-Positionierer: das Bild lässt sich im Kreis verschieben und zoomen —
 * exakt der sichtbare Ausschnitt wird als scharfes 512px-WebP gespeichert.
 * „Cover"-Fit als Basis (Bild deckt den Kreis immer), Panning wird so begrenzt,
 * dass keine Ränder in den Kreis geraten.
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (result: File) => void;
}) {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [nat, setNat] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [saving, setSaving] = React.useState(false);
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // „Cover"-Basisskalierung + effektive Skalierung inkl. Zoom.
  const base = nat ? VIEW / Math.min(nat.w, nat.h) : 1;
  const eff = base * zoom;
  const dw = nat ? nat.w * eff : VIEW;
  const dh = nat ? nat.h * eff : VIEW;
  const maxX = Math.max(0, (dw - VIEW) / 2);
  const maxY = Math.max(0, (dh - VIEW) / 2);

  const clamp = React.useCallback(
    (x: number, y: number) => ({
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }),
    [maxX, maxY],
  );

  // Beim Zoom-Wechsel Offset neu begrenzen.
  React.useEffect(() => {
    setOffset((o) => clamp(o.x, o.y));
  }, [zoom, clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clamp(nx, ny));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z - e.deltaY * 0.0015)));
  };

  // Bild-Position (top-left) im Fenster: mittig + Offset.
  const tx = (VIEW - dw) / 2 + offset.x;
  const ty = (VIEW - dh) / 2 + offset.y;

  const speichern = async () => {
    if (!nat || saving) return;
    setSaving(true);
    try {
      const bitmap = await createImageBitmap(file);
      const srcSize = VIEW / eff;
      const srcX = Math.max(0, -tx / eff);
      const srcY = Math.max(0, -ty / eff);
      const canvas = document.createElement("canvas");
      canvas.width = ZIEL;
      canvas.height = ZIEL;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("kein Canvas");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, srcX, srcY, srcSize, srcSize, 0, 0, ZIEL, ZIEL);
      bitmap.close?.();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/webp", 0.9),
      );
      if (!blob) throw new Error("kein Blob");
      onConfirm(new File([blob], "avatar.webp", { type: "image/webp" }));
    } catch {
      // Fallback: Originaldatei unverändert übergeben.
      onConfirm(file);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Profilbild positionieren</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Move className="size-3.5" /> Ziehen zum Verschieben · Rad/Regler zum Zoomen
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {/* Zuschnitt-Fenster */}
          <div
            className="relative shrink-0 touch-none select-none overflow-hidden rounded-full ring-1 ring-border"
            style={{ width: VIEW, height: VIEW, cursor: drag.current ? "grabbing" : "grab" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNat({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              className="pointer-events-none absolute max-w-none origin-top-left will-change-transform"
              style={{
                width: dw,
                height: dh,
                transform: `translate3d(${tx}px, ${ty}px, 0)`,
              }}
            />
            {!nat && (
              <span className="absolute inset-0 flex items-center justify-center bg-muted/40">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </span>
            )}
            {/* feiner Innenring als Kreis-Führung */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/25"
            />
          </div>

          {/* Zoom-Regler */}
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.2))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Verkleinern"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-[color:var(--primary)]"
              style={{ accentColor: "var(--primary)" }}
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.2))}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Vergrößern"
            >
              <Plus className="size-4" />
            </button>
            <ZoomIn className="size-4 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={speichern} disabled={saving || !nat}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
