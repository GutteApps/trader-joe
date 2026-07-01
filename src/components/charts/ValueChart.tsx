"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { t: number; value: number };

function fmtAxisDate(t: number) {
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export default function ValueChart({
  data,
  currency = "USD",
}: {
  data: Point[];
  currency?: string;
}) {
  const up =
    data.length > 1 ? data[data.length - 1].value >= data[0].value : true;
  const stroke = up ? "var(--gain)" : "var(--loss)";

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
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
          formatter={(v: number) => [
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency,
            }).format(v),
            "Value",
          ]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill="url(#valueFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
