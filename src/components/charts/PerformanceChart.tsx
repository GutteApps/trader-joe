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
type PortfolioOpt = { id: string; name: string };

const TIMEFRAMES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 365, label: "1Y" },
];

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

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
  valueSeries: initialValueSeries,
  portfolioId,
  currency = "USD",
  benchmarks,
  portfolios = [],
  defaultKey,
  initialSeries,
  days: initialDays = 30,
}: {
  valueSeries: ValuePoint[];
  portfolioId: string;
  currency?: string;
  benchmarks: Benchmark[];
  portfolios?: PortfolioOpt[];
  defaultKey: string;
  initialSeries: PricePoint[];
  days?: number;
}) {
  const [days, setDays] = useState(initialDays);
  const [selected, setSelected] = useState(defaultKey);

  // Series are cached per timeframe so switching back is instant. The default
  // 30D portfolio + benchmark series are seeded from the server.
  const [valueCache, setValueCache] = useState<Record<number, ValuePoint[]>>({
    [initialDays]: initialValueSeries,
  });
  const [cmpCache, setCmpCache] = useState<Record<string, PricePoint[]>>({
    [`${defaultKey}:${initialDays}`]: initialSeries,
  });

  const valueSeries = valueCache[days];
  const cmpKey = `${selected}:${days}`;

  // Resolve the current comparison selection.
  const isPortfolio = selected.startsWith("pf:");
  const activeBenchmark =
    !isPortfolio && selected !== "NONE"
      ? benchmarks.find((b) => b.key === selected)
      : undefined;
  const activePortfolio = isPortfolio
    ? portfolios.find((p) => `pf:${p.id}` === selected)
    : undefined;
  const activeLabel = activeBenchmark?.label ?? activePortfolio?.name;
  const hasActive = Boolean(activeBenchmark || activePortfolio);

  // Fetch this portfolio's value series for the chosen timeframe.
  useEffect(() => {
    if (valueCache[days]) return;
    let cancelled = false;
    fetch(`/api/portfolios/${portfolioId}/series?days=${days}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.ok) setValueCache((c) => ({ ...c, [days]: j.data }));
      });
    return () => {
      cancelled = true;
    };
  }, [days, portfolioId, valueCache]);

  // Fetch the comparison series for the chosen selection + timeframe.
  useEffect(() => {
    if (!hasActive || cmpCache[cmpKey]) return;
    let cancelled = false;
    const url = activePortfolio
      ? `/api/portfolios/${activePortfolio.id}/series?days=${days}`
      : `/api/prices/history?symbol=${encodeURIComponent(activeBenchmark!.symbol)}&assetType=${activeBenchmark!.assetType}&days=${days}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.ok) return;
        const pts: PricePoint[] = activePortfolio
          ? (j.data as ValuePoint[]).map((d) => ({ t: d.t, price: d.value }))
          : (j.data as PricePoint[]);
        setCmpCache((c) => ({ ...c, [cmpKey]: pts }));
      });
    return () => {
      cancelled = true;
    };
  }, [cmpKey, days, hasActive, activePortfolio, activeBenchmark, cmpCache]);

  const loadingValue = !valueSeries;
  const loadingCmp = hasActive && !cmpCache[cmpKey];

  const { data, portfolioReturn, comparisonReturn } = useMemo(() => {
    const vs = valueSeries ?? [];
    const baseIdx = vs.findIndex((p) => p.value > 0);
    const start = baseIdx < 0 ? 0 : baseIdx;
    const baseValue = vs[start]?.value ?? 0;

    const series = hasActive ? (cmpCache[cmpKey] ?? []) : [];
    const sorted = [...series].sort((a, b) => a.t - b.t);

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

    const basePrice = hasActive ? priceForDay(vs[start]?.t ?? 0) : null;

    const rows = vs.map((p, i) => {
      const cmpPrice = hasActive ? priceForDay(p.t) : null;
      const cmpValue =
        hasActive && basePrice && cmpPrice && i >= start
          ? baseValue * (cmpPrice / basePrice)
          : null;
      return { t: p.t, portfolio: p.value, comparison: cmpValue };
    });

    const lastValue = vs[vs.length - 1]?.value ?? baseValue;
    const lastCmp = rows[rows.length - 1]?.comparison ?? null;

    return {
      data: rows,
      portfolioReturn: baseValue > 0 ? (lastValue / baseValue - 1) * 100 : 0,
      comparisonReturn:
        lastCmp != null && baseValue > 0 ? (lastCmp / baseValue - 1) * 100 : null,
    };
  }, [valueSeries, cmpCache, cmpKey, hasActive]);

  const beat = comparisonReturn != null && portfolioReturn >= comparisonReturn;

  const tickFmt = (t: number) =>
    new Date(t).toLocaleDateString(
      "en-US",
      days >= 180 ? { month: "short" } : { month: "short", day: "numeric" },
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-muted">Performance</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
              <span className="text-muted">Portfolio</span>
              <span className="tabular font-medium" style={{ color: portfolioReturn >= 0 ? "var(--gain)" : "var(--loss)" }}>
                {pct(portfolioReturn)}
              </span>
            </span>
            {hasActive && comparisonReturn != null ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-muted)" }} />
                <span className="text-muted">{activeLabel}</span>
                <span className="tabular font-medium" style={{ color: comparisonReturn >= 0 ? "var(--gain)" : "var(--loss)" }}>
                  {pct(comparisonReturn)}
                </span>
              </span>
            ) : null}
            {hasActive && comparisonReturn != null ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  color: beat ? "var(--gain)" : "var(--loss)",
                  background: beat ? "var(--gain-soft)" : "var(--loss-soft)",
                }}
              >
                {beat ? "Outperforming" : "Underperforming"} by{" "}
                {Math.abs(portfolioReturn - comparisonReturn).toFixed(2)}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-surface-2 p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.days}
                type="button"
                onClick={() => setDays(tf.days)}
                className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: days === tf.days ? "var(--surface)" : "transparent",
                  color: days === tf.days ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span>vs</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            >
              <optgroup label="Benchmarks">
                {benchmarks.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
              {portfolios.length > 0 ? (
                <optgroup label="Portfolios">
                  {portfolios.map((p) => (
                    <option key={p.id} value={`pf:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value="NONE">None</option>
            </select>
          </label>
        </div>
      </div>

      {loadingValue ? (
        <div className="h-[260px] animate-pulse rounded-lg bg-surface-2 opacity-50" />
      ) : (
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
              tickFormatter={tickFmt}
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
                name === "portfolio" ? "Portfolio" : (activeLabel ?? "Comparison"),
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
            {hasActive ? (
              <Line
                type="monotone"
                dataKey="comparison"
                stroke="var(--text-muted)"
                strokeWidth={1.75}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {loadingCmp && !loadingValue ? (
        <p className="mt-1 text-center text-xs text-faint">Loading {activeLabel}…</p>
      ) : hasActive && !loadingCmp && (cmpCache[cmpKey]?.length ?? 0) === 0 ? (
        <p className="mt-1 text-center text-xs text-faint">
          {activeLabel} data unavailable right now.
        </p>
      ) : null}
    </div>
  );
}
