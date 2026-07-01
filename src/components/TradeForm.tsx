"use client";

import { useActionState, useState } from "react";
import { tradeAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

type Holding = { symbol: string; assetType: "CRYPTO" | "STOCK"; quantity: number };

export default function TradeForm({
  portfolioId,
  holdings,
}: {
  portfolioId: string;
  holdings: Holding[];
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [state, action, pending] = useActionState(tradeAction, initial);

  const selling = side === "SELL";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="side" value={side} />

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-1">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className="rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{
              background:
                side === s
                  ? s === "BUY"
                    ? "var(--gain-soft)"
                    : "var(--loss-soft)"
                  : "transparent",
              color:
                side === s
                  ? s === "BUY"
                    ? "var(--gain)"
                    : "var(--loss)"
                  : "var(--text-muted)",
            }}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {selling && holdings.length > 0 ? (
        <label className="block text-xs font-medium text-muted">
          Position
          <select
            name="symbol"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            onChange={(e) => {
              const h = holdings.find((x) => x.symbol === e.target.value);
              const at = document.querySelector<HTMLInputElement>(
                'input[name="assetType"]',
              );
              if (h && at) at.value = h.assetType;
            }}
          >
            {holdings.map((h) => (
              <option key={h.symbol} value={h.symbol} data-type={h.assetType}>
                {h.symbol} — {h.quantity} held
              </option>
            ))}
          </select>
          <input
            type="hidden"
            name="assetType"
            defaultValue={holdings[0]?.assetType ?? "CRYPTO"}
          />
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-xs font-medium text-muted">
            Symbol
            <input
              name="symbol"
              required
              placeholder="BTC / AAPL"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm uppercase outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Type
            <select
              name="assetType"
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="CRYPTO">Crypto</option>
              <option value="STOCK">Stock</option>
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-muted">
          Quantity
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
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
            placeholder="market"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block text-xs font-medium text-muted">
        Approved by
        <input
          name="approvedBy"
          placeholder="who signed off"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      {state.error ? <p className="text-xs text-loss">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-xs" style={{ color: "var(--gain)" }}>
          Trade recorded.
        </p>
      ) : null}

      <button
        disabled={pending}
        className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: selling ? "var(--loss)" : "var(--gain)" }}
      >
        {pending ? "Recording…" : selling ? "Record sell" : "Record buy"}
      </button>
    </form>
  );
}
