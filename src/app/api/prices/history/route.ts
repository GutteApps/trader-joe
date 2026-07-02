import { NextResponse } from "next/server";
import type { AssetType } from "@prisma/client";
import { getHistory } from "@/lib/prices";

// GET /api/prices/history?symbol=SPY&assetType=STOCK&days=30
// Same-origin helper the performance chart uses to load benchmark series.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim();
  const assetType = searchParams.get("assetType");
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days")) || 30));

  if (!symbol || (assetType !== "CRYPTO" && assetType !== "STOCK")) {
    return NextResponse.json(
      { ok: false, error: "symbol and assetType (CRYPTO|STOCK) are required" },
      { status: 400 },
    );
  }

  const data = await getHistory(symbol, assetType as AssetType, days);
  return NextResponse.json({ ok: true, data });
}
