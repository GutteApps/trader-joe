// Lightweight technical-analysis helpers (pure functions, safe on the client).

export type PricePoint = { t: number; price: number };

export type Levels = {
  support: number | null;
  resistance: number | null;
  last: number | null;
};

/**
 * Estimate nearest support & resistance from a price series.
 *
 * Finds swing highs/lows (a point that is the local extreme within a ±k window),
 * then takes the nearest swing-high above the latest price as resistance and the
 * nearest swing-low below it as support. Falls back to the period high/low.
 */
export function supportResistance(points: PricePoint[]): Levels {
  const prices = points.map((p) => p.price).filter((p) => Number.isFinite(p));
  if (prices.length < 5) {
    return { support: null, resistance: null, last: prices.at(-1) ?? null };
  }
  const last = prices[prices.length - 1];
  const k = Math.min(20, Math.max(3, Math.round(prices.length * 0.03)));

  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    const lo = Math.max(0, i - k);
    const hi = Math.min(prices.length - 1, i + k);
    let isHigh = true;
    let isLow = true;
    for (let j = lo; j <= hi; j++) {
      if (prices[j] > prices[i]) isHigh = false;
      if (prices[j] < prices[i]) isLow = false;
    }
    if (isHigh) swingHighs.push(prices[i]);
    if (isLow) swingLows.push(prices[i]);
  }

  const above = swingHighs.filter((p) => p > last * 1.002).sort((a, b) => a - b);
  const below = swingLows.filter((p) => p < last * 0.998).sort((a, b) => b - a);

  const resistance = above[0] ?? Math.max(...prices);
  const support = below[0] ?? Math.min(...prices);
  return { support, resistance, last };
}
