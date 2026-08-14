"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { RegistrationPoint } from "./registrations-chart";

export type { RegistrationPoint };

// recharts (großer Chunk) erst clientseitig nachladen → raus aus dem
// First-Load-JS der Startseite.
const Chart = dynamic(
  () => import("./registrations-chart").then((m) => m.RegistrationsChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

export function RegistrationsChart(props: { data: RegistrationPoint[] }) {
  return <Chart {...props} />;
}
