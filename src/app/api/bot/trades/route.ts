import { ok, fail, requireBot, parseBody } from "@/lib/api";
import { createTradeSchema } from "@/lib/schemas";
import { applyTrade, TradeError } from "@/lib/portfolio";
import { getQuote } from "@/lib/prices";

// POST /api/bot/trades — record a BUY or SELL.
//
// The bot sends this once the WhatsApp group approves a pick (buy) or decides
// to exit (sell). `price` is optional — if omitted we use the live market
// price. `approvedBy` records who in the group signed off.
export async function POST(req: Request) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const body = await parseBody(req, createTradeSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const price = d.price ?? (await getQuote(d.symbol, d.assetType));
  if (price == null) {
    return fail(
      `Could not resolve a market price for ${d.symbol}; send an explicit "price".`,
      422,
    );
  }

  try {
    const { trade, position } = await applyTrade({
      portfolioId: d.portfolioId,
      symbol: d.symbol,
      name: d.name,
      assetType: d.assetType,
      side: d.side,
      quantity: d.quantity,
      price,
      fee: d.fee,
      approvedBy: d.approvedBy,
      source: d.source,
      note: d.note,
      executedAt: d.executedAt ? new Date(d.executedAt) : undefined,
      recommendationId: d.recommendationId,
    });
    return ok({ trade, position }, { status: 201 });
  } catch (err) {
    if (err instanceof TradeError) return fail(err.message, 422);
    console.error("trade error", err);
    return fail("Internal error recording trade", 500);
  }
}
