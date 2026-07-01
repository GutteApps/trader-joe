import Link from "next/link";
import {
  listPortfoliosWithValue,
  listPendingRecommendations,
} from "@/lib/queries";
import { TypeBadge, PctPill, EmptyState } from "@/components/ui";
import CreatePortfolioForm from "@/components/CreatePortfolioForm";
import { fmtCurrency, fmtSignedCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rows, pending] = await Promise.all([
    listPortfoliosWithValue(),
    listPendingRecommendations(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
          <p className="mt-1 text-sm text-muted">
            Paper &amp; real books tracked from the claw bot&rsquo;s signals.
          </p>
        </div>
        <CreatePortfolioForm />
      </div>

      {pending.length > 0 ? (
        <Link
          href="/recommendations"
          className="card flex items-center gap-3 p-4 transition-colors hover:border-accent"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
            ✦
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {pending.length} new signal{pending.length > 1 ? "s" : ""} from the
              bot
            </p>
            <p className="text-xs text-muted">
              Review and approve buys in the group.
            </p>
          </div>
          <span className="text-sm text-accent">Review →</span>
        </Link>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No portfolios yet"
          hint="Create your first paper portfolio to start tracking the bot's picks."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ portfolio, metrics }) => (
            <Link
              key={portfolio.id}
              href={`/portfolios/${portfolio.id}`}
              className="card group flex flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-accent"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-semibold tracking-tight">
                  {portfolio.name}
                </h2>
                <TypeBadge type={portfolio.type} />
              </div>
              <div>
                <p className="tabular text-2xl font-semibold tracking-tight">
                  {fmtCurrency(metrics.totalValue, portfolio.baseCurrency)}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <span
                    className="tabular"
                    style={{
                      color:
                        metrics.totalPnl >= 0 ? "var(--gain)" : "var(--loss)",
                    }}
                  >
                    {fmtSignedCurrency(metrics.totalPnl, portfolio.baseCurrency)}
                  </span>
                  {metrics.totalCost > 0 ? (
                    <PctPill value={metrics.totalPnlPct} />
                  ) : null}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border-soft pt-3 text-xs text-faint">
                <span>
                  {metrics.positions.length} open position
                  {metrics.positions.length === 1 ? "" : "s"}
                </span>
                <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
