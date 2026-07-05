import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPortfolioView } from "@/lib/queries";
import { getValueSeries } from "@/lib/portfolio";
import { getHistory } from "@/lib/prices";
import {
  BENCHMARKS,
  DEFAULT_BENCHMARK_KEY,
  getBenchmark,
} from "@/lib/benchmarks";
import PerformanceChart from "@/components/charts/PerformanceChart";
import AssetChart from "@/components/charts/AssetChart";
import AllocationChart from "@/components/charts/AllocationChart";
import TradeForm from "@/components/TradeForm";
import { TypeBadge, AssetBadge, PctPill, Stat } from "@/components/ui";
import {
  fmtCurrency,
  fmtNumber,
  fmtSignedCurrency,
  fmtDateTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getPortfolioView(id);
  if (!view) notFound();

  const { portfolio, metrics, trades } = view;
  const cur = portfolio.baseCurrency;

  const defaultBenchmark = getBenchmark(DEFAULT_BENCHMARK_KEY)!;
  const [valueSeries, assetHistories, benchmarkSeries, otherPortfolios] =
    await Promise.all([
      getValueSeries(id, 30),
      Promise.all(
        metrics.positions.map((p) =>
          getHistory(p.position.symbol, p.position.assetType, 30),
        ),
      ),
      getHistory(defaultBenchmark.symbol, defaultBenchmark.assetType, 30),
      prisma.portfolio.findMany({
        where: { id: { not: id } },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const allocation = metrics.positions.map((p) => ({
    symbol: p.position.symbol,
    value: p.marketValue,
    pct: p.allocationPct,
  }));

  const holdingsForForm = metrics.positions.map((p) => ({
    symbol: p.position.symbol,
    assetType: p.position.assetType,
    quantity: p.position.quantity,
  }));

  return (
    <div className="space-y-8">
      {/* header */}
      <div>
        <Link
          href="/"
          className="text-sm text-muted transition-colors hover:text-text"
        >
          ← Portfolios
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {portfolio.name}
          </h1>
          <TypeBadge type={portfolio.type} />
        </div>
      </div>

      {/* metrics */}
      <div className="card grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
        <Stat label="Total value">
          {fmtCurrency(metrics.totalValue, cur)}
        </Stat>
        <Stat
          label="Total P&L"
          sub={metrics.totalCost > 0 ? <PctPill value={metrics.totalPnlPct} /> : undefined}
        >
          <span
            style={{
              color: metrics.totalPnl >= 0 ? "var(--gain)" : "var(--loss)",
            }}
          >
            {fmtSignedCurrency(metrics.totalPnl, cur)}
          </span>
        </Stat>
        <Stat label="Unrealized">
          <span
            style={{
              color: metrics.unrealizedPnl >= 0 ? "var(--gain)" : "var(--loss)",
            }}
          >
            {fmtSignedCurrency(metrics.unrealizedPnl, cur)}
          </span>
        </Stat>
        <Stat label="Realized">
          <span
            style={{
              color: metrics.realizedPnl >= 0 ? "var(--gain)" : "var(--loss)",
            }}
          >
            {fmtSignedCurrency(metrics.realizedPnl, cur)}
          </span>
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* left/main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* performance vs benchmark */}
          <section className="card p-5">
            {valueSeries.length > 1 ? (
              <PerformanceChart
                valueSeries={valueSeries}
                portfolioId={portfolio.id}
                currency={cur}
                benchmarks={BENCHMARKS}
                portfolios={otherPortfolios}
                defaultKey={DEFAULT_BENCHMARK_KEY}
                initialSeries={benchmarkSeries}
                days={30}
              />
            ) : (
              <>
                <h2 className="mb-3 text-sm font-semibold text-muted">
                  Performance · 30d
                </h2>
                <div className="grid h-[200px] place-items-center text-sm text-faint">
                  Value history appears once there are trades with price data.
                </div>
              </>
            )}
          </section>

          {/* holdings */}
          <section className="card overflow-hidden">
            <h2 className="border-b border-border-soft px-5 py-4 text-sm font-semibold text-muted">
              Holdings
            </h2>
            {metrics.positions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-faint">
                No open positions. Record a buy to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-faint">
                      <th className="px-5 py-2.5 font-medium">Asset</th>
                      <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        Avg cost
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        Price
                      </th>
                      <th className="px-3 py-2.5 text-right font-medium">
                        Value
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.positions.map((p) => (
                      <tr
                        key={p.position.id}
                        className="border-t border-border-soft"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {p.position.symbol}
                            </span>
                            <AssetBadge assetType={p.position.assetType} />
                          </div>
                          <span className="text-xs text-faint">
                            {p.allocationPct.toFixed(1)}% of book
                          </span>
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {fmtNumber(p.position.quantity)}
                        </td>
                        <td className="tabular px-3 py-3 text-right text-muted">
                          {fmtCurrency(p.position.avgCost, cur)}
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {p.currentPrice != null
                            ? fmtCurrency(p.currentPrice, cur)
                            : "—"}
                        </td>
                        <td className="tabular px-3 py-3 text-right">
                          {fmtCurrency(p.marketValue, cur)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div
                            className="tabular"
                            style={{
                              color:
                                p.unrealizedPnl >= 0
                                  ? "var(--gain)"
                                  : "var(--loss)",
                            }}
                          >
                            {fmtSignedCurrency(p.unrealizedPnl, cur)}
                          </div>
                          <div className="text-xs">
                            <PctPill value={p.unrealizedPnlPct} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* per-asset charts */}
          {metrics.positions.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted">
                Price history &amp; entries
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {metrics.positions.map((p, i) => {
                  const markers = trades
                    .filter(
                      (t) =>
                        t.symbol.toUpperCase() ===
                        p.position.symbol.toUpperCase(),
                    )
                    .map((t) => ({
                      t: new Date(t.executedAt).getTime(),
                      price: t.price,
                      side: t.side as "BUY" | "SELL",
                    }));
                  return (
                    <div key={p.position.id} className="card p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {p.position.symbol}
                          </span>
                          <AssetBadge assetType={p.position.assetType} />
                        </div>
                        <span className="tabular text-sm text-muted">
                          {p.currentPrice != null
                            ? fmtCurrency(p.currentPrice, cur)
                            : "—"}
                        </span>
                      </div>
                      <AssetChart
                        data={assetHistories[i].map((h) => ({
                          t: h.t,
                          price: h.price,
                        }))}
                        markers={markers}
                        currency={cur}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        {/* right rail */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Record a trade
            </h2>
            <TradeForm portfolioId={portfolio.id} holdings={holdingsForForm} />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-muted">Allocation</h2>
            <AllocationChart slices={allocation} />
          </section>
        </div>
      </div>

      {/* trade history */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-border-soft px-5 py-4 text-sm font-semibold text-muted">
          Trade history
        </h2>
        {trades.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-faint">
            No trades yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Side</th>
                  <th className="px-3 py-2.5 font-medium">Asset</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Value</th>
                  <th className="px-3 py-2.5 font-medium">Approved by</th>
                  <th className="px-5 py-2.5 font-medium">Via</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-border-soft">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">
                      {fmtDateTime(t.executedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          color:
                            t.side === "BUY" ? "var(--gain)" : "var(--loss)",
                          background:
                            t.side === "BUY"
                              ? "var(--gain-soft)"
                              : "var(--loss-soft)",
                        }}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium">{t.symbol}</td>
                    <td className="tabular px-3 py-3 text-right">
                      {fmtNumber(t.quantity)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {fmtCurrency(t.price, cur)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      {fmtCurrency(t.price * t.quantity, cur)}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {t.approvedBy ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-faint">
                      {t.source === "BOT" ? "Bot" : "Manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
