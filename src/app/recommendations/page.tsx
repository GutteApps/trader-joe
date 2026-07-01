import { prisma } from "@/lib/db";
import { listPendingRecommendations } from "@/lib/queries";
import RecommendationCard from "@/components/RecommendationCard";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const [pending, portfolios] = await Promise.all([
    listPendingRecommendations(),
    prisma.portfolio.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
        <p className="mt-1 text-sm text-muted">
          Daily picks from the claw bot. Approve to record a buy, or dismiss.
        </p>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          title="No pending signals"
          hint="When the bot posts a pick via the API it shows up here to approve."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pending.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={{
                id: rec.id,
                symbol: rec.symbol,
                name: rec.name,
                assetType: rec.assetType,
                rationale: rec.rationale,
                targetPrice: rec.targetPrice,
                suggestedQty: rec.suggestedQty,
                priceAtRec: rec.priceAtRec,
                createdAt: rec.createdAt,
              }}
              portfolios={portfolios}
            />
          ))}
        </div>
      )}
    </div>
  );
}
