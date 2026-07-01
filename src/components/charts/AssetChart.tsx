"use client";

import {
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { t: number; price: number };
type Marker = { t: number; price: number; side: "BUY" | "SELL" };

function fmtAxisDate(t: number) {
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function AssetChart({
  data,
  markers = [],
  currency = "USD",
}: {
  data: Point[];
  markers?: Marker[];
  currency?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-[180px] place-items-center text-xs text-faint">
        No price history available
      </div>
    );
  }

  const min = Math.min(...data.map((d) => d.price));
  const max = Math.max(...data.map((d) => d.price));
  const pad = (max - min) * 0.08 || max * 0.05;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtAxisDate}
          tick={{ fill: "var(--text-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          minTickGap={44}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          hide
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
          formatter={(v: number) => [
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency,
              maximumFractionDigits: v < 1 ? 4 : 2,
            }).format(v),
            "Price",
          ]}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
        {markers.map((m, i) => (
          <ReferenceDot
            key={i}
            x={m.t}
            y={m.price}
            r={4}
            fill={m.side === "BUY" ? "var(--gain)" : "var(--loss)"}
            stroke="var(--bg)"
            strokeWidth={1.5}
            isFront
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
