"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supportResistance, type PricePoint } from "@/lib/ta";

function fmtAxisDate(t: number) {
  return new Date(t).toLocaleDateString("en-US", { month: "short" });
}
function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n < 1 ? 4 : 2,
  }).format(n);
}

export default function SignalChart({
  symbol,
  assetType,
  currency = "USD",
}: {
  symbol: string;
  assetType: "CRYPTO" | "STOCK";
  currency?: string;
}) {
  const [data, setData] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(
      `/api/prices/history?symbol=${encodeURIComponent(symbol)}&assetType=${assetType}&days=365`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j.ok ? j.data : []);
      })
      .catch(() => !cancelled && setData([]));
    return () => {
      cancelled = true;
    };
  }, [symbol, assetType]);

  const { support, resistance } = useMemo(
    () => supportResistance(data ?? []),
    [data],
  );

  if (data === null) {
    return (
      <div className="h-[170px] animate-pulse rounded-lg bg-surface-2 opacity-60" />
    );
  }
  if (data.length === 0) {
    return (
      <div className="grid h-[170px] place-items-center rounded-lg bg-surface-2/40 text-xs text-faint">
        12-month price data unavailable
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const lo = Math.min(...prices, support ?? Infinity);
  const hi = Math.max(...prices, resistance ?? -Infinity);
  const pad = (hi - lo) * 0.06 || hi * 0.05;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted">12-month range</span>
        <div className="flex items-center gap-3">
          {resistance != null ? (
            <span className="flex items-center gap-1" style={{ color: "var(--loss)" }}>
              <span className="inline-block h-[2px] w-3" style={{ background: "var(--loss)" }} />
              R {fmtMoney(resistance, currency)}
            </span>
          ) : null}
          {support != null ? (
            <span className="flex items-center gap-1" style={{ color: "var(--gain)" }}>
              <span className="inline-block h-[2px] w-3" style={{ background: "var(--gain)" }} />
              S {fmtMoney(support, currency)}
            </span>
          ) : null}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtAxisDate}
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis domain={[lo - pad, hi + pad]} hide />
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
            formatter={(v: number) => [fmtMoney(v, currency), "Price"]}
          />
          {resistance != null ? (
            <ReferenceLine
              y={resistance}
              stroke="var(--loss)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
          ) : null}
          {support != null ? (
            <ReferenceLine
              y={support}
              stroke="var(--gain)"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--accent)"
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
