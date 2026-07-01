// Read helpers shared by the web UI (server components) and the bot's GET
// endpoints, so both see identical, already-valued data.

import { prisma } from "./db";
import { getQuotes } from "./prices";
import { computeMetrics, type PortfolioMetrics } from "./portfolio";

export async function listPortfoliosWithValue() {
  const portfolios = await prisma.portfolio.findMany({
    orderBy: { createdAt: "asc" },
    include: { positions: true },
  });

  const allOpen = portfolios.flatMap((p) =>
    p.positions
      .filter((pos) => pos.quantity > 0)
      .map((pos) => ({ symbol: pos.symbol, assetType: pos.assetType })),
  );
  const quotes = await getQuotes(allOpen);

  return portfolios.map((p) => ({
    portfolio: p,
    metrics: computeMetrics(p.positions, quotes),
  }));
}

export type PortfolioView = {
  portfolio: Awaited<ReturnType<typeof prisma.portfolio.findUniqueOrThrow>>;
  metrics: PortfolioMetrics;
  trades: Awaited<ReturnType<typeof prisma.trade.findMany>>;
};

export async function getPortfolioView(id: string) {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id },
    include: {
      positions: { orderBy: { openedAt: "asc" } },
      trades: { orderBy: { executedAt: "desc" }, take: 200 },
    },
  });
  if (!portfolio) return null;

  const quotes = await getQuotes(
    portfolio.positions
      .filter((p) => p.quantity > 0)
      .map((p) => ({ symbol: p.symbol, assetType: p.assetType })),
  );
  const metrics = computeMetrics(portfolio.positions, quotes);

  return { portfolio, metrics, trades: portfolio.trades };
}

export async function listPendingRecommendations() {
  return prisma.recommendation.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}
