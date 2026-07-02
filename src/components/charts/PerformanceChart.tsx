"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Benchmark } from "@/lib/benchmarks";

type ValuePoint = { t: number; value: number };
type PricePoint = { t: number; price: number };

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function fmtAxisDate(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
function pct(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
}

export default function PerformanceChart({
  valueSeries,
  currency = "USD",
  benchmarks,
  defaultKey,
  initialSeries,
  days = 30,
}: {
  valueSeries: ValuePoint[];
  currency?: string;
  benchmarks: Benchmark[];
  defaultKey: string;
  initialSeries: PricePoint[];
  days?: number;
}) {
  const [selected, setSelected] = useState(defaultKey);
  const [cache, setCache] = useState<Record<string, PricePoint[]>>({
    [defaultKey]: initialSeries,
  });
  const [loading, setLoading] = useState(false);

  const active = selected === "NONE" ? undefined : benchmarks.find((b) => b.key === selected);

  // Fetch benchmark history on demand (default is seeded from the server).
  useEffect(() => {
    if (!active || cache[selected]) return;
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/prices/history?symbol=${encodeURIComponent(active.symbol)}&assetType=${active.assetType}&days=${days}`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok) setCache((c) => ({ ...c, [selected]: j.data }));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, active, cache, days]);

  const { data, portfolioReturn, benchmarkReturn } = useMemo(() => {
    // Base off the first day the portfolio actually holds value, so a book that
    // started mid-window still compares fairly against the benchmark.
    const baseIdx = valueSeries.findIndex((p) => p.value > 0);
    const start = baseIdx < 0 ? 0 : baseIdx;
    const baseValue = valueSeries[start]?.value ?? 0;

    const series = active ? (cache[selected] ?? []) : [];
    const sorted = [...series].sort((a, b) => a.t - b.t);

    // Forward-filled benchmark price for the base day and each portfolio day.
    let ptr = 0;
    let lastPrice: number | null = null;
    const priceForDay = (t: number): number | null => {
      const key = dayKey(t);
      while (ptr < sorted.length && dayKey(sorted[ptr].t) <= key) {
        lastPrice = sorted[ptr].price;
        ptr++;
      }
      return lastPrice;
    };

    const basePrice = active ? priceForDay(valueSeries[start]?.t ?? 0) : null;

    const rows = valueSeries.map((p, i) => {
      const benchPrice = active ? priceForDay(p.t) : null;
      const benchValue =
        active && basePrice && benchPrice && i >= start
          ? baseValue * (benchPrice / basePrice)
          : null;
      return { t: p.t, portfolio: p.value, benchmark: benchValue };
    });

    const lastValue = valueSeries[valueSeries.length - 1]?.value ?? baseValue;
    const lastBench = rows[rows.length - 1]?.benchmark ?? null;

    return {
      data: rows,
      portfolioReturn: baseValue > 0 ? (lastValue / baseValue - 1) * 100 : 0,
      benchmarkReturn:
        lastBench != null && baseValue > 0 ? (lastBench / baseValue - 1) * 100 : null,
    };
  }, [valueSeries, cache, selected, active]);

  const beat = benchmarkReturn != null && portfolioReturn >= benchmarkReturn;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-muted">Performance · {days}d</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
              <span className="text-muted">Portfolio</span>
              <span className="tabular font-medium" style={{ color: portfolioReturn >= 0 ? "var(--gain)" : "var(--loss)" }}>
                {pct(portfolioReturn)}
              </span>
            </span>
            {active && benchmarkReturn != null ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-muted)" }} />
                <span className="text-muted">{active.label}</span>
                <span className="tabular font-medium" style={{ color: benchmarkReturn >= 0 ? "var(--gain)" : "var(--loss)" }}>
                  {pct(benchmarkReturn)}
                </span>
              </span>
            ) : null}
            {active && benchmarkReturn != null ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  color: beat ? "var(--gain)" : "var(--loss)",
                  background: beat ? "var(--gain-soft)" : "var(--loss-soft)",
                }}
              >
                {beat ? "Outperforming" : "Underperforming"} by{" "}
                {Math.abs(portfolioReturn - benchmarkReturn).toFixed(2)}%
              </span>
            ) : null}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span>vs</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          >
            {benchmarks.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
            <option value="NONE">None</option>
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtAxisDate}
            tick={{ fill: "var(--text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={fmtCompact}
            tick={{ fill: "var(--text-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--text)",
              fontSize: 12,
            }}
            labelFormatter={(t) =>
              new Date(t as number).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            }
            formatter={(v: number, name: string) => [
              v == null ? "—" : fmtMoney(v, currency),
              name === "portfolio" ? "Portfolio" : (active?.label ?? "Benchmark"),
            ]}
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#perfFill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          {active ? (
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="var(--text-muted)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
      {loading ? (
        <p className="mt-1 text-center text-xs text-faint">Loading {active?.label}…</p>
      ) : active && (cache[selected]?.length ?? 0) === 0 && !loading ? (
        <p className="mt-1 text-center text-xs text-faint">
          {active.label} data unavailable right now.
        </p>
      ) : null}
    </div>
  );
}
