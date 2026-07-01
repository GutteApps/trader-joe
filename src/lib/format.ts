export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function fmtCurrency(n: number, currency = "USD"): string {
  const abs = Math.abs(n);
  const maxFrac = abs > 0 && abs < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

export function fmtSignedCurrency(n: number, currency = "USD"): string {
  const s = fmtCurrency(Math.abs(n), currency);
  return `${n < 0 ? "−" : "+"}${s}`;
}

export function fmtNumber(n: number, maxFrac = 6): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFrac,
  }).format(n);
}

export function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
