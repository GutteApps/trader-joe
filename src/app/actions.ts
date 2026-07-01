"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { applyTrade, TradeError } from "@/lib/portfolio";
import { getQuote } from "@/lib/prices";
import {
  createPortfolioSchema,
  createTradeSchema,
} from "@/lib/schemas";

export type ActionState = { error?: string; ok?: boolean };

export async function createPortfolioAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createPortfolioSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "FAKE",
    baseCurrency: formData.get("baseCurrency") || "USD",
  });
  if (!parsed.success) return { error: "Please enter a valid name." };

  const portfolio = await prisma.portfolio.create({ data: parsed.data });
  revalidatePath("/");
  redirect(`/portfolios/${portfolio.id}`);
}

export async function tradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTradeSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    side: formData.get("side"),
    quantity: Number(formData.get("quantity")),
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    approvedBy: formData.get("approvedBy") || undefined,
    note: formData.get("note") || undefined,
    source: "MANUAL",
  });
  if (!parsed.success) {
    return { error: "Check the trade details (symbol, quantity, price)." };
  }
  const d = parsed.data;

  const price = d.price ?? (await getQuote(d.symbol, d.assetType));
  if (price == null) {
    return { error: `Couldn't fetch a price for ${d.symbol}. Enter one manually.` };
  }

  try {
    await applyTrade({
      portfolioId: d.portfolioId,
      symbol: d.symbol,
      assetType: d.assetType,
      side: d.side,
      quantity: d.quantity,
      price,
      approvedBy: d.approvedBy,
      note: d.note,
      source: "MANUAL",
    });
  } catch (err) {
    if (err instanceof TradeError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/portfolios/${d.portfolioId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function approveRecommendationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const recommendationId = String(formData.get("recommendationId") || "");
  const portfolioId = String(formData.get("portfolioId") || "");
  const quantity = Number(formData.get("quantity"));
  const approvedBy = String(formData.get("approvedBy") || "").trim();
  const priceRaw = formData.get("price");

  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!rec) return { error: "Recommendation not found." };
  if (!portfolioId) return { error: "Pick a portfolio to buy into." };
  if (!(quantity > 0)) return { error: "Enter a quantity greater than 0." };
  if (!approvedBy) return { error: "Enter who approved this buy." };

  const price =
    (priceRaw ? Number(priceRaw) : undefined) ??
    rec.priceAtRec ??
    (await getQuote(rec.symbol, rec.assetType));
  if (price == null) {
    return { error: `Couldn't fetch a price for ${rec.symbol}. Enter one manually.` };
  }

  try {
    await applyTrade({
      portfolioId,
      symbol: rec.symbol,
      name: rec.name,
      assetType: rec.assetType,
      side: "BUY",
      quantity,
      price,
      approvedBy,
      source: "MANUAL",
      recommendationId,
      note: rec.rationale ?? undefined,
    });
  } catch (err) {
    if (err instanceof TradeError) return { error: err.message };
    throw err;
  }

  revalidatePath("/recommendations");
  revalidatePath(`/portfolios/${portfolioId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function rejectRecommendationAction(formData: FormData) {
  const id = String(formData.get("recommendationId") || "");
  if (!id) return;
  await prisma.recommendation.update({
    where: { id },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  revalidatePath("/recommendations");
}
