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
import { getHistory, type PricePoint } from "./prices";

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

    let position: Position;

    if (input.side === "BUY") {
      if (existing) {
        const newQty = existing.quantity + qty;
        const newBasis = existing.quantity * existing.avgCost + qty * price + fee;
        position = await tx.position.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            avgCost: newBasis / newQty,
            assetType: input.assetType,
            status: "OPEN",
            closedAt: null,
            ...(input.name ? { name: input.name } : {}),
          },
        });
      } else {
        position = await tx.position.create({
          data: {
            portfolioId: input.portfolioId,
            symbol,
            assetType: input.assetType,
            quantity: qty,
            avgCost: (qty * price + fee) / qty,
            name: input.name ?? null,
            status: "OPEN",
          },
        });
      }
    } else {
      // SELL
      if (!existing || existing.quantity <= EPS) {
        throw new TradeError(`no open position in ${symbol} to sell`);
      }
      if (qty > existing.quantity + EPS) {
        throw new TradeError(
          `cannot sell ${qty} ${symbol}; only ${existing.quantity} held`,
        );
      }
      const proceeds = qty * price - fee;
      const costOfSold = qty * existing.avgCost;
      const newQty = existing.quantity - qty;
      const closed = newQty <= EPS;
      position = await tx.position.update({
        where: { id: existing.id },
        data: {
          quantity: closed ? 0 : newQty,
          realizedPnl: existing.realizedPnl + (proceeds - costOfSold),
          status: closed ? "CLOSED" : "OPEN",
          closedAt: closed ? (input.executedAt ?? new Date()) : null,
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
  const open = positions.filter((p) => p.quantity > EPS);
  let totalValue = 0;
  let totalCost = 0;
  let unrealizedPnl = 0;
  const realizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);

  const rows = open.map((position) => {
    const currentPrice = quotes[position.symbol.toUpperCase()] ?? null;
    const costBasis = position.quantity * position.avgCost;
    const marketValue =
      currentPrice != null ? position.quantity * currentPrice : costBasis;
    const pnl = marketValue - costBasis;
    totalValue += marketValue;
    totalCost += costBasis;
    unrealizedPnl += currentPrice != null ? pnl : 0;
    return {
      position,
      currentPrice,
      marketValue,
      costBasis,
      unrealizedPnl: currentPrice != null ? pnl : 0,
      unrealizedPnlPct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
      allocationPct: 0, // filled below
    };
  });

  for (const r of rows) {
    r.allocationPct = totalValue > 0 ? (r.marketValue / totalValue) * 100 : 0;
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
  await Promise.all(
    [...symbols.entries()].map(async ([symbol, assetType]) => {
      const pts = await getHistory(symbol, assetType, days + 2);
      histories.set(symbol, buildDailyIndex(pts));
    }),
  );

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
