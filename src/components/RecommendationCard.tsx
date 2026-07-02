"use client";

import { useActionState, useState } from "react";
import {
  approveRecommendationAction,
  rejectRecommendationAction,
  type ActionState,
} from "@/app/actions";
import { AssetBadge } from "@/components/ui";
import SignalChart from "@/components/charts/SignalChart";
import { fmtCurrency, fmtDateTime } from "@/lib/format";

const initial: ActionState = {};

type Rec = {
  id: string;
  symbol: string;
  name: string | null;
  assetType: "CRYPTO" | "STOCK";
  rationale: string | null;
  targetPrice: number | null;
  suggestedQty: number | null;
  priceAtRec: number | null;
  createdAt: string | Date;
};

type PortfolioOpt = { id: string; name: string; type: "FAKE" | "REAL" };

export default function RecommendationCard({
  rec,
  portfolios,
}: {
  rec: Rec;
  portfolios: PortfolioOpt[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(
    approveRecommendationAction,
    initial,
  );

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{rec.symbol}</span>
            <AssetBadge assetType={rec.assetType} />
          </div>
          {rec.name ? (
            <p className="truncate text-sm text-muted">{rec.name}</p>
          ) : null}
        </div>
        <div className="text-right text-xs text-faint">
          {fmtDateTime(rec.createdAt)}
        </div>
      </div>

      {rec.rationale ? (
        <p className="mt-2 line-clamp-3 text-sm text-muted">{rec.rationale}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {rec.priceAtRec != null ? (
          <span>
            Signal price{" "}
            <span className="tabular text-text">
              {fmtCurrency(rec.priceAtRec)}
            </span>
          </span>
        ) : null}
        {rec.targetPrice != null ? (
          <span>
            Target{" "}
            <span className="tabular text-text">
              {fmtCurrency(rec.targetPrice)}
            </span>
          </span>
        ) : null}
        {rec.suggestedQty != null ? (
          <span>
            Suggested qty{" "}
            <span className="tabular text-text">{rec.suggestedQty}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-3 border-t border-border-soft pt-3">
        <SignalChart symbol={rec.symbol} assetType={rec.assetType} />
      </div>

      {!expanded ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setExpanded(true)}
            disabled={portfolios.length === 0}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--gain)" }}
            title={
              portfolios.length === 0 ? "Create a portfolio first" : undefined
            }
          >
            Approve & buy
          </button>
          <form action={rejectRecommendationAction}>
            <input type="hidden" name="recommendationId" value={rec.id} />
            <button
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:text-text"
              type="submit"
            >
              Dismiss
            </button>
          </form>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-2 border-t border-border-soft pt-3">
          <input type="hidden" name="recommendationId" value={rec.id} />
          <label className="block text-xs font-medium text-muted">
            Buy into
            <select
              name="portfolioId"
              required
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type === "REAL" ? "real" : "paper"})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted">
              Quantity
              <input
                name="quantity"
                type="number"
                step="any"
                min="0"
                defaultValue={rec.suggestedQty ?? undefined}
                required
                className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Price <span className="text-faint">(blank = live)</span>
              <input
                name="price"
                type="number"
                step="any"
                min="0"
                defaultValue={rec.priceAtRec ?? undefined}
                className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted">
            Approved by
            <input
              name="approvedBy"
              required
              placeholder="who signed off in the group"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          {state.error ? (
            <p className="text-xs text-loss">{state.error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--gain)" }}
            >
              {pending ? "Recording…" : "Confirm buy"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
