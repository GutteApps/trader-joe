// Benchmarks a portfolio can be compared against over the same time window.
// Stock/ETF proxies resolve via Stooq (no key); crypto via CoinGecko.

export type AssetKind = "CRYPTO" | "STOCK";

export type Benchmark = {
  key: string;
  label: string;
  symbol: string;
  assetType: AssetKind;
};

export const BENCHMARKS: Benchmark[] = [
  { key: "SP500", label: "S&P 500", symbol: "SPY", assetType: "STOCK" },
  { key: "NASDAQ", label: "Nasdaq 100", symbol: "QQQ", assetType: "STOCK" },
  { key: "BTC", label: "Bitcoin", symbol: "BTC", assetType: "CRYPTO" },
  { key: "ETH", label: "Ethereum", symbol: "ETH", assetType: "CRYPTO" },
  { key: "GOLD", label: "Gold", symbol: "GLD", assetType: "STOCK" },
];

export const DEFAULT_BENCHMARK_KEY = "SP500";

export function getBenchmark(key: string): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.key === key);
}
