"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapCompany, MapJob } from "./germany-map";

export type { MapCompany, MapJob };

// Die interaktive SVG-Karte (großer Client-Chunk) erst clientseitig nachladen →
// raus aus dem First-Load-JS der Route /karte. Verhalten/Optik unverändert.
const Map = dynamic(
  () => import("./germany-map").then((m) => m.GermanyMap),
  { ssr: false, loading: () => <Skeleton className="h-[600px] w-full rounded-lg" /> },
);

export function GermanyMap(props: { companies: MapCompany[]; jobs: MapJob[] }) {
  return <Map {...props} />;
}
