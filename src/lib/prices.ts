// Market-price service.
//
// Crypto  -> CoinGecko (free, no API key).
// Stocks  -> Finnhub live quote (needs FINNHUB_API_KEY) with a keyless Stooq
//            fallback; history always from Stooq (free CSV, no key).
//
// All prices are returned in USD. Results are cached in-memory with a short TTL
// so we don't hammer the upstream APIs on every render.

import type { AssetType } from "@prisma/client";

export type PricePoint = { t: number; price: number }; // t = epoch ms (UTC day)

// ---------------------------------------------------------------------------
// tiny in-memory cache
// ---------------------------------------------------------------------------
type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// symbol -> CoinGecko id resolution
// ---------------------------------------------------------------------------
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  UNI: "uniswap",
  BNB: "binancecoin",
  TRX: "tron",
  SHIB: "shiba-inu",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  USDC: "usd-coin",
  USDT: "tether",
};

let coinListCache: { map: Record<string, string>; expires: number } | null = null;

async function resolveCoinId(symbol: string): Promise<string | null> {
  const sym = symbol.toUpperCase();
  if (COINGECKO_IDS[sym]) return COINGECKO_IDS[sym];

  // Fall back to CoinGecko's full coin list (cached 24h), picking the first
  // id that matches the ticker.
  if (!coinListCache || coinListCache.expires < Date.now()) {
    const res = await safeFetch("https://api.coingecko.com/api/v3/coins/list");
    const map: Record<string, string> = {};
    if (res) {
      const list = (await res.json()) as { id: string; symbol: string }[];
      for (const c of list) {
        const s = c.symbol.toUpperCase();
        if (!map[s]) map[s] = c.id; // first match wins
      }
    }
    coinListCache = { map, expires: Date.now() + 24 * 60 * 60 * 1000 };
  }
  return coinListCache.map[sym] ?? null;
}

// ---------------------------------------------------------------------------
// live quotes
// ---------------------------------------------------------------------------
async function cryptoQuote(symbol: string): Promise<number | null> {
  const id = await resolveCoinId(symbol);
  if (!id) return null;
  const res = await safeFetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
  );
  if (!res) return null;
  const data = (await res.json()) as Record<string, { usd?: number }>;
  return data[id]?.usd ?? null;
}

async function stockQuote(symbol: string): Promise<number | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    const res = await safeFetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
    );
    if (res) {
      const data = (await res.json()) as { c?: number };
      if (data.c && data.c > 0) return data.c;
    }
  }
  // keyless fallback: last close from Stooq
  const hist = await stockHistory(symbol, 5);
  return hist.length ? hist[hist.length - 1].price : null;
}

export async function getQuote(
  symbol: string,
  assetType: AssetType,
): Promise<number | null> {
  return cached(`quote:${assetType}:${symbol.toUpperCase()}`, 60_000, () =>
    assetType === "CRYPTO" ? cryptoQuote(symbol) : stockQuote(symbol),
  );
}

export async function getQuotes(
  items: { symbol: string; assetType: AssetType }[],
): Promise<Record<string, number>> {
  const unique = new Map<string, AssetType>();
  for (const it of items) unique.set(it.symbol.toUpperCase(), it.assetType);
  const out: Record<string, number> = {};
  await Promise.all(
    [...unique.entries()].map(async ([symbol, assetType]) => {
      const q = await getQuote(symbol, assetType);
      if (q != null) out[symbol] = q;
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// historical series
// ---------------------------------------------------------------------------
async function cryptoHistory(symbol: string, days: number): Promise<PricePoint[]> {
  const id = await resolveCoinId(symbol);
  if (!id) return [];
  const res = await safeFetch(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
  );
  if (!res) return [];
  const data = (await res.json()) as { prices?: [number, number][] };
  return (data.prices ?? []).map(([t, price]) => ({ t, price }));
}

async function stockHistory(symbol: string, days: number): Promise<PricePoint[]> {
  // Stooq daily CSV, no key required. US tickers use the ".us" suffix.
  const s = symbol.toLowerCase();
  const ticker = s.includes(".") ? s : `${s}.us`;
  const res = await safeFetch(`https://stooq.com/q/d/l/?s=${ticker}&i=d`);
  if (!res) return [];
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const points: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, , , , close] = lines[i].split(",");
    const price = Number(close);
    const t = new Date(`${date}T00:00:00Z`).getTime();
    if (Number.isFinite(price) && Number.isFinite(t)) points.push({ t, price });
  }
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return points.filter((p) => p.t >= cutoff);
}

export async function getHistory(
  symbol: string,
  assetType: AssetType,
  days = 30,
): Promise<PricePoint[]> {
  return cached(
    `hist:${assetType}:${symbol.toUpperCase()}:${days}`,
    15 * 60_000,
    () =>
      assetType === "CRYPTO"
        ? cryptoHistory(symbol, days)
        : stockHistory(symbol, days),
  );
}
