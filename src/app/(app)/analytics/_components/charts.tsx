"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

const nf = new Intl.NumberFormat("de-DE");

/* --- Funnel --------------------------------------------------------------- */

export interface FunnelStep {
  name: string;
  value: number;
  /** Prozent vom vorherigen Schritt (0–100), null für den ersten. */
  pct: number | null;
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const data = steps.map((s) => ({
    ...s,
    label: s.pct === null ? "" : `${s.pct} %`,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          formatter={(value) => [nf.format(Number(value)), "Anzahl"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FunnelLegend({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {steps.map(
        (s, i) =>
          s.pct !== null && (
            <span key={i} className="tabular">
              {steps[i - 1]?.name} → {s.name}:{" "}
              <span className="font-medium text-foreground">{s.pct} %</span>
            </span>
          ),
      )}
    </div>
  );
}

/* --- Tages-Zeitreihe ------------------------------------------------------ */

export interface DailyPoint {
  day: string;
  label: string;
  value: number;
}

export function DailyAreaChart({
  data,
  color,
  name,
}: {
  data: DailyPoint[];
  color: string;
  name: string;
}) {
  const gradientId = `grad-${name.replace(/\W/g, "")}`;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--border)"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          minTickGap={28}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [nf.format(Number(value)), name]}
          labelFormatter={(label) => `Tag: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          name={name}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* --- Referral-Donut ------------------------------------------------------- */

export interface DonutSlice {
  name: string;
  value: number;
}

export function ReferralDonut({ data }: { data: DonutSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [nf.format(Number(value)), String(name)]}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DonutLegend({ data }: { data: DonutSlice[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
          />
          <span className="text-muted-foreground">{d.name}</span>
          <span className="ml-auto font-medium tabular">
            {nf.format(d.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
