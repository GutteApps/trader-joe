import { cn, fmtPct } from "@/lib/format";
import type { AssetType, PortfolioType } from "@prisma/client";

export function PnlText({
  value,
  currency = "USD",
  className,
}: {
  value: number;
  currency?: string;
  className?: string;
}) {
  const up = value >= 0;
  const body = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return (
    <span
      className={cn("tabular", className)}
      style={{ color: up ? "var(--gain)" : "var(--loss)" }}
    >
      {up ? "+" : "−"}
      {body}
    </span>
  );
}

export function PctPill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className="tabular inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
      style={{
        color: up ? "var(--gain)" : "var(--loss)",
        background: up ? "var(--gain-soft)" : "var(--loss-soft)",
      }}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {fmtPct(value).replace(/^[+−]/, "")}
    </span>
  );
}

export function TypeBadge({ type }: { type: PortfolioType }) {
  const real = type === "REAL";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
      )}
      style={{
        color: real ? "var(--warn)" : "var(--accent-2)",
        borderColor: real ? "rgba(245,158,11,0.35)" : "rgba(34,211,238,0.35)",
        background: real ? "rgba(245,158,11,0.08)" : "rgba(34,211,238,0.08)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: real ? "var(--warn)" : "var(--accent-2)" }}
      />
      {real ? "Real" : "Paper"}
    </span>
  );
}

export function AssetBadge({ assetType }: { assetType: AssetType }) {
  const crypto = assetType === "CRYPTO";
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
      style={{ background: "var(--surface-2)" }}
    >
      {crypto ? "Crypto" : "Stock"}
    </span>
  );
}

export function Stat({
  label,
  children,
  sub,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      <span className="tabular text-2xl font-semibold tracking-tight">
        {children}
      </span>
      {sub ? <span className="text-sm text-muted">{sub}</span> : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="card grid place-items-center gap-1 p-10 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
