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
    // Note: deliberately no custom User-Agent — Yahoo Finance rate-limits (429)
    // browser-like UAs from servers but serves the default runtime UA fine.
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
  // keyless: Yahoo live price, falling back to the last daily close.
  const sym = encodeURIComponent(symbol.toUpperCase());
  const res = await safeFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d`,
  );
  if (res) {
    const json = (await res.json()) as YahooChart;
    const r = json.chart?.result?.[0];
    const live = r?.meta?.regularMarketPrice;
    if (live && Number.isFinite(live)) return live;
    const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => c != null && Number.isFinite(c),
    );
    if (closes.length) return closes[closes.length - 1];
  }
  return null;
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

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
};

function yahooRange(days: number): string {
  if (days <= 5) return "5d";
  if (days <= 32) return "1mo";
  if (days <= 93) return "3mo";
  if (days <= 186) return "6mo";
  return "1y";
}

async function stockHistory(symbol: string, days: number): Promise<PricePoint[]> {
  // Yahoo Finance chart API — no key. Works for stocks, ETFs (SPY/QQQ/GLD)
  // and indices. Symbols are used as-is (uppercased).
  const sym = encodeURIComponent(symbol.toUpperCase());
  const res = await safeFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${yahooRange(days)}&interval=1d`,
  );
  if (!res) return [];
  const json = (await res.json()) as YahooChart;
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const points: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const price = closes[i];
    if (price == null || !Number.isFinite(price)) continue;
    points.push({ t: ts[i] * 1000, price });
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
