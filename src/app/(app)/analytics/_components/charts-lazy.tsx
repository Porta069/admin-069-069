"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyPoint, DonutSlice, FunnelStep } from "./charts";

export type { DailyPoint, DonutSlice, FunnelStep };

// recharts erst clientseitig nachladen → raus aus dem First-Load-JS von /analytics.
const bar = () => <Skeleton className="h-56 w-full" />;
const line = () => <Skeleton className="h-6 w-full" />;

const LazyFunnelChart = dynamic(
  () => import("./charts").then((m) => m.FunnelChart),
  { ssr: false, loading: bar },
);
const LazyFunnelLegend = dynamic(
  () => import("./charts").then((m) => m.FunnelLegend),
  { ssr: false, loading: line },
);
const LazyDailyAreaChart = dynamic(
  () => import("./charts").then((m) => m.DailyAreaChart),
  { ssr: false, loading: bar },
);
const LazyReferralDonut = dynamic(
  () => import("./charts").then((m) => m.ReferralDonut),
  { ssr: false, loading: bar },
);
const LazyDonutLegend = dynamic(
  () => import("./charts").then((m) => m.DonutLegend),
  { ssr: false, loading: line },
);

export function FunnelChart(props: { steps: FunnelStep[] }) {
  return <LazyFunnelChart {...props} />;
}
export function FunnelLegend(props: { steps: FunnelStep[] }) {
  return <LazyFunnelLegend {...props} />;
}
export function DailyAreaChart(props: {
  data: DailyPoint[];
  color: string;
  name: string;
}) {
  return <LazyDailyAreaChart {...props} />;
}
export function ReferralDonut(props: { data: DonutSlice[] }) {
  return <LazyReferralDonut {...props} />;
}
export function DonutLegend(props: { data: DonutSlice[] }) {
  return <LazyDonutLegend {...props} />;
}
