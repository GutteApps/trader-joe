// Core portfolio logic: applying buys/sells to positions, valuing a portfolio
// against live prices, and reconstructing a historical value curve.

import type {
  AssetType,
  Position,
  Trade,
  TradeSide,
  TradeSource,
} from "@prisma/client";
import { prisma } from "./db";
import { getHistory, getQuotes, type PricePoint } from "./prices";

const EPS = 1e-9;

export type ApplyTradeInput = {
  portfolioId: string;
  symbol: string;
  assetType: AssetType;
  side: TradeSide;
  quantity: number;
  price: number;
  name?: string | null;
  fee?: number;
  approvedBy?: string | null;
  source?: TradeSource;
  note?: string | null;
  executedAt?: Date;
  recommendationId?: string | null;
};

export class TradeError extends Error {}

/**
 * Apply a BUY or SELL: creates the Trade row and updates (or creates/closes)
 * the Position with fresh average cost + realized P&L. Runs in a transaction so
 * a position and its trade never drift apart.
 */
export async function applyTrade(
  input: ApplyTradeInput,
): Promise<{ trade: Trade; position: Position }> {
  const symbol = input.symbol.toUpperCase();
  const qty = input.quantity;
  const price = input.price;
  const fee = input.fee ?? 0;

  if (!(qty > 0)) throw new TradeError("quantity must be greater than 0");
  if (!(price >= 0)) throw new TradeError("price must be >= 0");

  return prisma.$transaction(async (tx) => {
    const portfolio = await tx.portfolio.findUnique({
      where: { id: input.portfolioId },
    });
    if (!portfolio) throw new TradeError(`portfolio ${input.portfolioId} not found`);

    const existing = await tx.position.findUnique({
      where: { portfolioId_symbol: { portfolioId: input.portfolioId, symbol } },
    });

    // Signed-quantity model: positive quantity = long, negative = short.
    // A BUY adds +qty, a SELL adds -qty. This supports opening/adding to a
    // position, reducing/closing it, covering a short, and flipping through
    // zero (e.g. selling more than a long held opens a short for the remainder).
    const dir = input.side === "BUY" ? 1 : -1;
    const q0 = existing?.quantity ?? 0;
    const avg0 = existing?.avgCost ?? 0;
    const realized0 = existing?.realizedPnl ?? 0;

    let newQty: number;
    let newAvg: number;
    let newRealized = realized0;

    if (q0 === 0 || Math.sign(q0) === dir) {
      // opening a fresh position, or adding to the same side (long or short)
      const absOld = Math.abs(q0);
      newQty = q0 + dir * qty;
      newAvg = (absOld * avg0 + qty * price) / (absOld + qty);
      newRealized = realized0 - fee;
    } else {
      // reducing / covering the opposite side; may flip through zero
      const closeQty = Math.min(qty, Math.abs(q0));
      // long closed by a SELL profits when price > entry; short covered by a
      // BUY profits when price < entry.
      const pnlPerShare = q0 > 0 ? price - avg0 : avg0 - price;
      newRealized = realized0 + pnlPerShare * closeQty - fee;
      newQty = q0 + dir * qty;
      if (Math.abs(newQty) <= EPS) newAvg = avg0; // fully flat
      else if (Math.sign(newQty) === Math.sign(q0)) newAvg = avg0; // partial close
      else newAvg = price; // flipped: remainder opened at this fill price
    }

    const closed = Math.abs(newQty) <= EPS;
    const status = closed ? "CLOSED" : "OPEN";
    const closedAt = closed ? (input.executedAt ?? new Date()) : null;

    let position: Position;
    if (existing) {
      position = await tx.position.update({
        where: { id: existing.id },
        data: {
          quantity: closed ? 0 : newQty,
          avgCost: newAvg,
          realizedPnl: newRealized,
          assetType: input.assetType,
          status,
          closedAt,
          ...(input.name ? { name: input.name } : {}),
        },
      });
    } else {
      position = await tx.position.create({
        data: {
          portfolioId: input.portfolioId,
          symbol,
          assetType: input.assetType,
          quantity: closed ? 0 : newQty,
          avgCost: newAvg,
          realizedPnl: newRealized,
          name: input.name ?? null,
          status,
          closedAt,
        },
      });
    }

    const trade = await tx.trade.create({
      data: {
        portfolioId: input.portfolioId,
        positionId: position.id,
        symbol,
        assetType: input.assetType,
        side: input.side,
        quantity: qty,
        price,
        fee,
        approvedBy: input.approvedBy ?? null,
        source: input.source ?? "BOT",
        note: input.note ?? null,
        executedAt: input.executedAt ?? new Date(),
      },
    });

    if (input.recommendationId) {
      await tx.recommendation.update({
        where: { id: input.recommendationId },
        data: {
          status: input.side === "BUY" ? "APPROVED" : "REJECTED",
          approvedBy: input.approvedBy ?? null,
          decidedAt: new Date(),
          tradeId: trade.id,
        },
      });
    }

    return { trade, position };
  });
}

// ---------------------------------------------------------------------------
// valuation
// ---------------------------------------------------------------------------
export type PositionValue = {
  position: Position;
  currentPrice: number | null;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  allocationPct: number;
};

export type PortfolioMetrics = {
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: PositionValue[];
};

export function computeMetrics(
  positions: Position[],
  quotes: Record<string, number>,
): PortfolioMetrics {
  // Include both longs (quantity > 0) and shorts (quantity < 0).
  const open = positions.filter((p) => Math.abs(p.quantity) > EPS);
  let totalValue = 0;
  let totalCost = 0;
  let unrealizedPnl = 0;
  const realizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);

  const rows = open.map((position) => {
    const currentPrice = quotes[position.symbol.toUpperCase()] ?? null;
    // Signed: shorts have negative quantity, so costBasis/marketValue are
    // negative and `pnl` is naturally inverted (short profits when price falls).
    const costBasis = position.quantity * position.avgCost;
    const marketValue =
      currentPrice != null ? position.quantity * currentPrice : costBasis;
    const pnl = marketValue - costBasis;
    // Totals use gross (absolute) exposure so shorts add value instead of
    // cancelling longs; P&L stays signed and correct.
    totalValue += Math.abs(marketValue);
    totalCost += Math.abs(costBasis);
    unrealizedPnl += currentPrice != null ? pnl : 0;
    return {
      position,
      currentPrice,
      marketValue,
      costBasis,
      unrealizedPnl: currentPrice != null ? pnl : 0,
      unrealizedPnlPct:
        Math.abs(costBasis) > EPS ? (pnl / Math.abs(costBasis)) * 100 : 0,
      allocationPct: 0, // filled below
    };
  });

  for (const r of rows) {
    r.allocationPct =
      totalValue > 0 ? (Math.abs(r.marketValue) / totalValue) * 100 : 0;
  }

  const totalPnl = unrealizedPnl + realizedPnl;
  return {
    totalValue,
    totalCost,
    unrealizedPnl,
    realizedPnl,
    totalPnl,
    totalPnlPct: totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0,
    positions: rows,
  };
}

// ---------------------------------------------------------------------------
// historical portfolio value curve
// ---------------------------------------------------------------------------
function dayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Forward-filled price lookup by day for one symbol. */
function buildDailyIndex(points: PricePoint[]): Map<string, number> {
  const idx = new Map<string, number>();
  for (const p of points) idx.set(dayKey(p.t), p.price);
  return idx;
}

/**
 * Reconstruct total portfolio value per day for the last `days` days by
 * replaying trades against each asset's historical price series.
 */
export async function getValueSeries(
  portfolioId: string,
  days = 30,
): Promise<{ t: number; value: number }[]> {
  const trades = await prisma.trade.findMany({
    where: { portfolioId },
    orderBy: { executedAt: "asc" },
  });
  if (trades.length === 0) return [];

  const symbols = new Map<string, AssetType>();
  for (const t of trades) symbols.set(t.symbol.toUpperCase(), t.assetType);

  const histories = new Map<string, Map<string, number>>();
  const lastKnown = new Map<string, number>();

  // Pre-seed each symbol with its live quote so a momentarily-unavailable price
  // history doesn't silently value the holding at $0 — the day loop still
  // prefers real historical prices where present.
  const [quotes] = await Promise.all([
    getQuotes(
      [...symbols.entries()].map(([symbol, assetType]) => ({ symbol, assetType })),
    ),
    Promise.all(
      [...symbols.entries()].map(async ([symbol, assetType]) => {
        const pts = await getHistory(symbol, assetType, days + 2);
        histories.set(symbol, buildDailyIndex(pts));
      }),
    ),
  ]);
  for (const [symbol] of symbols) {
    const q = quotes[symbol.toUpperCase()];
    if (q != null) lastKnown.set(symbol, q);
  }

  const out: { t: number; value: number }[] = [];
  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  for (let i = 0; i <= days; i++) {
    const t = start + i * 24 * 60 * 60 * 1000;
    const key = dayKey(t);
    const endOfDay = new Date(`${key}T23:59:59.999Z`).getTime();

    // holdings as of end of this day
    const holdings = new Map<string, number>();
    for (const tr of trades) {
      if (tr.executedAt.getTime() > endOfDay) break;
      const sym = tr.symbol.toUpperCase();
      const delta = (tr.side === "BUY" ? 1 : -1) * tr.quantity;
      holdings.set(sym, (holdings.get(sym) ?? 0) + delta);
    }

    let value = 0;
    for (const [sym, qty] of holdings) {
      if (qty <= EPS) continue;
      const px = histories.get(sym)?.get(key) ?? lastKnown.get(sym);
      if (px != null) {
        lastKnown.set(sym, px);
        value += qty * px;
      }
    }
    out.push({ t, value });
  }
  return out;
}
