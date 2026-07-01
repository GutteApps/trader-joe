"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Slice = { symbol: string; value: number; pct: number };

const COLORS = [
  "#6366f1",
  "#22d3ee",
  "#22c55e",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
  "#14b8a6",
  "#eab308",
];

export default function AllocationChart({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center text-xs text-faint">
        No holdings yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="symbol"
            innerRadius={44}
            outerRadius={68}
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.symbol} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="font-medium">{s.symbol}</span>
            <span className="tabular ml-auto text-muted">
              {s.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
