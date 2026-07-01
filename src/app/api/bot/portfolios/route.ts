import { prisma } from "@/lib/db";
import { ok, requireBot, parseBody } from "@/lib/api";
import { createPortfolioSchema } from "@/lib/schemas";
import { listPortfoliosWithValue } from "@/lib/queries";

// GET /api/bot/portfolios — list portfolios with current value + P&L
export async function GET(req: Request) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const rows = await listPortfoliosWithValue();
  return ok(
    rows.map(({ portfolio, metrics }) => ({
      id: portfolio.id,
      name: portfolio.name,
      type: portfolio.type,
      baseCurrency: portfolio.baseCurrency,
      totalValue: metrics.totalValue,
      totalPnl: metrics.totalPnl,
      openPositions: metrics.positions.length,
    })),
  );
}

// POST /api/bot/portfolios — create a portfolio
export async function POST(req: Request) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const body = await parseBody(req, createPortfolioSchema);
  if (!body.ok) return body.response;

  const portfolio = await prisma.portfolio.create({ data: body.data });
  return ok(portfolio, { status: 201 });
}
