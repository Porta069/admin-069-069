"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import {
  Briefcase,
  Building2,
  Crosshair,
  Minus,
  Plus,
  MapPin,
  X,
} from "lucide-react";

export interface MapCompany {
  id: string;
  name: string;
  ort: string | null;
  lat: number;
  lng: number;
  jobsCount: number;
}

export interface MapJob {
  id: string;
  title: string;
  city: string | null;
  lat: number;
  lng: number;
}

/* --- Projection (Web-Mercator auf Deutschland-Bounds) ------------------- */

const LAT_MIN = 47.2;
const LAT_MAX = 55.1;
const LNG_MIN = 5.8;
const LNG_MAX = 15.1;
const W = 600;

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const MERC_TOP = mercY(LAT_MAX);
const MERC_BOTTOM = mercY(LAT_MIN);
const H = Math.round(
  (W * (MERC_TOP - MERC_BOTTOM)) / (((LNG_MAX - LNG_MIN) * Math.PI) / 180),
);

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
  const y = ((MERC_TOP - mercY(lat)) / (MERC_TOP - MERC_BOTTOM)) * H;
  return { x, y };
}

function unproject(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / W) * (LNG_MAX - LNG_MIN) + LNG_MIN;
  const merc = MERC_TOP - (y / H) * (MERC_TOP - MERC_BOTTOM);
  const lat = ((Math.atan(Math.exp(merc)) - Math.PI / 4) * 360) / Math.PI;
  return { lat, lng };
}

/** km → SVG-Pixel (Mercator-Näherung am gegebenen Breitengrad). */
function kmToPx(lat: number, km: number): number {
  const dLatRad = km / 6371;
  const mercUnits = dLatRad / Math.cos((lat * Math.PI) / 180);
  return (mercUnits / (MERC_TOP - MERC_BOTTOM)) * H;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/* --- Grober Deutschland-Umriss (lat, lng) -------------------------------- */

const GERMANY_OUTLINE: [number, number][] = [
  [54.91, 8.6], [54.83, 9.42], [54.44, 9.85], [54.36, 10.15], [54.1, 10.8],
  [53.95, 11.0], [54.09, 11.45], [54.18, 12.1], [54.44, 12.55], [54.68, 13.43],
  [54.31, 13.75], [53.91, 14.22], [53.4, 14.35], [52.85, 14.15], [52.55, 14.63],
  [52.1, 14.75], [51.55, 14.75], [51.05, 14.98], [50.87, 14.8], [50.8, 14.3],
  [50.68, 13.5], [50.42, 12.98], [50.2, 12.3], [49.95, 12.5], [49.7, 12.55],
  [49.32, 12.9], [48.95, 13.5], [48.77, 13.83], [48.57, 13.45], [48.3, 13.03],
  [47.85, 12.9], [47.55, 12.2], [47.6, 11.6], [47.4, 11.25], [47.27, 10.9],
  [47.4, 10.45], [47.27, 10.17], [47.55, 9.75], [47.66, 9.18], [47.58, 8.6],
  [47.56, 7.9], [47.59, 7.59], [48.32, 7.7], [48.97, 8.23], [49.2, 7.45],
  [49.45, 6.85], [49.45, 6.38], [49.8, 6.42], [50.13, 6.13], [50.5, 6.2],
  [50.77, 6.02], [51.05, 5.87], [51.22, 6.07], [51.6, 6.1], [51.9, 6.15],
  [52.23, 7.06], [52.45, 6.7], [52.65, 7.05], [53.0, 7.2], [53.33, 7.29],
  [53.61, 7.0], [53.7, 7.6], [53.55, 8.15], [53.87, 8.7], [54.3, 8.6],
  [54.5, 8.9], [54.75, 8.55],
];

const OUTLINE_POINTS = GERMANY_OUTLINE.map(([lat, lng]) => {
  const { x, y } = project(lat, lng);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(" ");

/* --- Marker-Typen --------------------------------------------------------- */

interface Marker {
  kind: "company" | "job";
  id: string;
  label: string;
  sub: string | null;
  lat: number;
  lng: number;
}

interface Cluster {
  key: string;
  kind: "company" | "job";
  x: number;
  y: number;
  lat: number;
  lng: number;
  items: Marker[];
}

function clusterMarkers(markers: Marker[], scale: number): Cluster[] {
  const cellPx = 26 / scale;
  const map = new Map<string, Cluster>();
  for (const m of markers) {
    const { x, y } = project(m.lat, m.lng);
    const key = `${m.kind}:${Math.round(x / cellPx)}:${Math.round(y / cellPx)}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(m);
    } else {
      map.set(key, { key, kind: m.kind, x, y, lat: m.lat, lng: m.lng, items: [m] });
    }
  }
  return [...map.values()];
}

/* --- Komponente ----------------------------------------------------------- */

const MIN_SCALE = 1;
const MAX_SCALE = 14;

export function GermanyMap({
  companies,
  jobs,
}: {
  companies: MapCompany[];
  jobs: MapJob[];
}) {
  const router = useRouter();
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const [scale, setScale] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  const [showCompanies, setShowCompanies] = React.useState(true);
  const [showJobs, setShowJobs] = React.useState(true);
  const [radiusMode, setRadiusMode] = React.useState(false);
  const [radiusCenter, setRadiusCenter] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radiusKm, setRadiusKm] = React.useState(50);
  const [tooltip, setTooltip] = React.useState<{
    x: number;
    y: number;
    title: string;
    sub: string | null;
  } | null>(null);

  const drag = React.useRef<{
    startX: number;
    startY: number;
    tx: number;
    ty: number;
    moved: boolean;
  } | null>(null);

  const markers = React.useMemo<Marker[]>(() => {
    const list: Marker[] = [];
    if (showCompanies) {
      for (const c of companies) {
        list.push({
          kind: "company",
          id: c.id,
          label: c.name,
          sub: c.ort,
          lat: c.lat,
          lng: c.lng,
        });
      }
    }
    if (showJobs) {
      for (const j of jobs) {
        list.push({
          kind: "job",
          id: j.id,
          label: j.title,
          sub: j.city,
          lat: j.lat,
          lng: j.lng,
        });
      }
    }
    return list;
  }, [companies, jobs, showCompanies, showJobs]);

  const clusters = React.useMemo(
    () => clusterMarkers(markers, scale),
    [markers, scale],
  );

  const hits = React.useMemo(() => {
    if (!radiusCenter) return [];
    return markers
      .map((m) => ({
        ...m,
        distanceKm: haversineKm(radiusCenter.lat, radiusCenter.lng, m.lat, m.lng),
      }))
      .filter((m) => m.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 50);
  }, [markers, radiusCenter, radiusKm]);

  /** Bildschirm-Koordinaten → SVG-Weltkoordinaten (vor Transform). */
  const toWorld = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    const vy = ((clientY - rect.top) / rect.height) * H;
    return { x: (vx - tx) / scale, y: (vy - ty) / scale };
  };

  const zoomAt = (factor: number, cx = W / 2, cy = H / 2) => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const f = next / scale;
    setTx(cx - (cx - tx) * f);
    setTy(cy - (cy - ty) * f);
    setScale(next);
  };

  // Non-passiver Wheel-Listener, damit die Seite beim Zoomen nicht scrollt.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * W;
      const cy = ((e.clientY - rect.top) / rect.height) * H;
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, cx, cy);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      tx,
      ty,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * W;
    const dy = ((e.clientY - d.startY) / rect.height) * H;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
    setTx(d.tx + dx);
    setTy(d.ty + dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // Klick (kein Drag): im Radius-Modus Mittelpunkt setzen
    if (radiusMode) {
      const world = toWorld(e.clientX, e.clientY);
      if (world) {
        setRadiusCenter(unproject(world.x, world.y));
        setRadiusMode(false);
      }
    }
  };

  const centerPoint = radiusCenter
    ? project(radiusCenter.lat, radiusCenter.lng)
    : null;
  const radiusPx = radiusCenter ? kmToPx(radiusCenter.lat, radiusKm) : 0;

  const markerR = Math.max(4 / scale, 1.2);
  const empty = markers.length === 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="rounded-lg border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            onClick={() => setShowCompanies((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              showCompanies
                ? "border-transparent bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
            <Building2 className="size-3.5" />
            Unternehmen
          </button>
          <button
            type="button"
            onClick={() => setShowJobs((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              showJobs
                ? "border-transparent bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
            <Briefcase className="size-3.5" />
            Jobs
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={radiusMode ? "default" : "outline"}
              size="sm"
              className={cn("h-8", !radiusMode && "bg-card")}
              onClick={() => setRadiusMode((v) => !v)}
            >
              <Crosshair className="size-4" />
              {radiusMode ? "Klicke auf die Karte…" : "Radius setzen"}
            </Button>
            {radiusCenter && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Radius entfernen"
                onClick={() => setRadiusCenter(null)}
              >
                <X className="size-4" />
              </Button>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 bg-card"
                aria-label="Hineinzoomen"
                onClick={() => zoomAt(1.4)}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8 bg-card"
                aria-label="Herauszoomen"
                onClick={() => zoomAt(1 / 1.4)}
              >
                <Minus className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {radiusCenter && (
          <div className="flex items-center gap-3 border-b px-4 py-2 text-sm">
            <span className="text-muted-foreground">Radius</span>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="max-w-56 flex-1 accent-primary"
              aria-label="Suchradius in Kilometern"
            />
            <span className="font-medium tabular whitespace-nowrap">
              {radiusKm} km
            </span>
          </div>
        )}

        {/* Karte */}
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={cn(
              "block max-h-[70vh] w-full touch-none select-none",
              radiusMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              drag.current = null;
              setTooltip(null);
            }}
            role="img"
            aria-label="Deutschlandkarte mit Unternehmen und Jobs"
          >
            <defs>
              <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#map-grid)" />
            <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
              <polygon
                points={OUTLINE_POINTS}
                fill="var(--muted)"
                fillOpacity="0.55"
                stroke="var(--muted-foreground)"
                strokeOpacity="0.5"
                strokeWidth={1.2 / scale}
                strokeDasharray={`${5 / scale} ${4 / scale}`}
                strokeLinejoin="round"
              />

              {centerPoint && (
                <>
                  <circle
                    cx={centerPoint.x}
                    cy={centerPoint.y}
                    r={radiusPx}
                    fill="var(--primary)"
                    fillOpacity="0.08"
                    stroke="var(--primary)"
                    strokeWidth={1.5 / scale}
                    strokeDasharray={`${4 / scale} ${3 / scale}`}
                  />
                  <circle
                    cx={centerPoint.x}
                    cy={centerPoint.y}
                    r={3.5 / scale}
                    fill="var(--primary)"
                  />
                </>
              )}

              {clusters.map((cluster) => {
                const color =
                  cluster.kind === "company" ? "var(--chart-1)" : "var(--chart-2)";
                if (cluster.items.length === 1) {
                  const m = cluster.items[0];
                  return (
                    <circle
                      key={cluster.key}
                      cx={cluster.x}
                      cy={cluster.y}
                      r={markerR}
                      fill={color}
                      fillOpacity="0.85"
                      stroke="var(--card)"
                      strokeWidth={1 / scale}
                      className="cursor-pointer"
                      onPointerEnter={(e) => {
                        const rect = svgRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          title: m.label,
                          sub: m.sub,
                        });
                      }}
                      onPointerLeave={() => setTooltip(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          m.kind === "company"
                            ? `/unternehmen/${m.id}`
                            : `/stellen/${m.id}`,
                        );
                      }}
                    />
                  );
                }
                const r = Math.min(markerR * 2.6, markerR + cluster.items.length * 0.4);
                return (
                  <g
                    key={cluster.key}
                    className="cursor-pointer"
                    onPointerEnter={(e) => {
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTooltip({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        title: `${cluster.items.length} ${cluster.kind === "company" ? "Unternehmen" : "Jobs"}`,
                        sub: "Klicken zum Zoomen",
                      });
                    }}
                    onPointerLeave={() => setTooltip(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      zoomAt(2, cluster.x * scale + tx, cluster.y * scale + ty);
                    }}
                  >
                    <circle
                      cx={cluster.x}
                      cy={cluster.y}
                      r={r}
                      fill={color}
                      fillOpacity="0.85"
                      stroke="var(--card)"
                      strokeWidth={1.2 / scale}
                    />
                    <text
                      x={cluster.x}
                      y={cluster.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={Math.max(r * 0.9, 3)}
                      fontWeight={600}
                    >
                      {cluster.items.length}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 max-w-56 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
            >
              <p className="truncate font-medium">{tooltip.title}</p>
              {tooltip.sub && (
                <p className="truncate text-muted-foreground">{tooltip.sub}</p>
              )}
            </div>
          )}

          {empty && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border bg-card/95 px-6 py-4 text-center shadow-sm">
                <p className="text-sm font-semibold">Keine verorteten Einträge</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Sobald Unternehmen oder Jobs Koordinaten haben, erscheinen sie
                  hier.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Legende */}
        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
            Unternehmen
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: "var(--chart-2)" }} />
            Aktive Jobs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t border-dashed border-muted-foreground/60" />
            Umriss (vereinfacht)
          </span>
          <span className="ml-auto">Zoomen: Mausrad · Verschieben: Ziehen</span>
        </div>
      </div>

      {/* Radius-Treffer */}
      <aside className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MapPin className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Umkreissuche</h3>
          {radiusCenter && (
            <span className="ml-auto text-xs text-muted-foreground tabular">
              {hits.length} Treffer · {radiusKm} km
            </span>
          )}
        </div>
        {!radiusCenter ? (
          <EmptyState
            icon={Crosshair}
            title="Kein Mittelpunkt gesetzt"
            description="„Radius setzen“ aktivieren und auf die Karte klicken, um Unternehmen und Jobs im Umkreis zu finden."
            className="border-0 py-12"
          />
        ) : hits.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Keine Treffer im Radius"
            description="Radius vergrößern oder Mittelpunkt verschieben."
            className="border-0 py-12"
          />
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                  onClick={() =>
                    router.push(
                      hit.kind === "company"
                        ? `/unternehmen/${hit.id}`
                        : `/stellen/${hit.id}`,
                    )
                  }
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                    style={{
                      background:
                        hit.kind === "company"
                          ? "var(--chart-1)"
                          : "var(--chart-2)",
                    }}
                  >
                    {hit.kind === "company" ? (
                      <Building2 className="size-3.5" />
                    ) : (
                      <Briefcase className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {hit.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hit.sub ?? (hit.kind === "company" ? "Unternehmen" : "Job")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {hit.distanceKm < 10
                      ? hit.distanceKm.toFixed(1)
                      : Math.round(hit.distanceKm)}{" "}
                    km
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
