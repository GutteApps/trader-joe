import type { RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, requireBot, parseBody } from "@/lib/api";
import { createRecommendationSchema } from "@/lib/schemas";
import { getQuote } from "@/lib/prices";

const REC_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;

// GET /api/bot/recommendations?status=PENDING — list recommendations
export async function GET(req: Request) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const status = new URL(req.url).searchParams.get("status");
  const where =
    status && REC_STATUSES.includes(status as RecommendationStatus)
      ? { status: status as RecommendationStatus }
      : {};

  const recs = await prisma.recommendation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(recs);
}

// POST /api/bot/recommendations — the claw bot posts a daily pick.
// If priceAtRec is omitted we snapshot the current market price.
export async function POST(req: Request) {
  const unauth = requireBot(req);
  if (unauth) return unauth;

  const body = await parseBody(req, createRecommendationSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const priceAtRec =
    d.priceAtRec ?? (await getQuote(d.symbol, d.assetType)) ?? undefined;

  const rec = await prisma.recommendation.create({
    data: {
      portfolioId: d.portfolioId ?? null,
      symbol: d.symbol.toUpperCase(),
      name: d.name,
      assetType: d.assetType,
      rationale: d.rationale,
      targetPrice: d.targetPrice,
      suggestedQty: d.suggestedQty,
      priceAtRec,
    },
  });
  return ok(rec, { status: 201 });
}
