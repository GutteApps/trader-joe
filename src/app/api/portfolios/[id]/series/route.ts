import { NextResponse } from "next/server";
import { getValueSeries } from "@/lib/portfolio";

// GET /api/portfolios/:id/series?days=30
// Value-over-time series, used to compare one portfolio against another.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days")) || 30));
  const data = await getValueSeries(id, days);
  return NextResponse.json({ ok: true, data });
}
