import { ok, fail, requireBot, parseBody } from "@/lib/api";
import { getPortfolioView } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { updatePortfolioSchema } from "@/lib/schemas";

// GET /api/bot/portfolios/:id — full portfolio with holdings, values, and
// recent trades. Lets the bot read current holdings before deciding to sell.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const { id } = await params;
  const view = await getPortfolioView(id);
  if (!view) return fail("Portfolio not found", 404);

  const { portfolio, metrics, trades } = view;
  return ok({
    id: portfolio.id,
    name: portfolio.name,
    type: portfolio.type,
    baseCurrency: portfolio.baseCurrency,
    totalValue: metrics.totalValue,
    totalCost: metrics.totalCost,
    unrealizedPnl: metrics.unrealizedPnl,
    realizedPnl: metrics.realizedPnl,
    totalPnl: metrics.totalPnl,
    holdings: metrics.positions.map((p) => ({
      symbol: p.position.symbol,
      assetType: p.position.assetType,
      quantity: p.position.quantity,
      avgCost: p.position.avgCost,
      currentPrice: p.currentPrice,
      marketValue: p.marketValue,
      unrealizedPnl: p.unrealizedPnl,
      allocationPct: p.allocationPct,
    })),
    recentTrades: trades.slice(0, 50),
  });
}

// PATCH /api/bot/portfolios/:id — update a portfolio (rename, type, currency).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const { id } = await params;
  const body = await parseBody(req, updatePortfolioSchema);
  if (!body.ok) return body.response;

  const portfolio = await prisma.portfolio
    .update({ where: { id }, data: body.data })
    .catch(() => null);
  if (!portfolio) return fail("Portfolio not found", 404);
  return ok(portfolio);
}
