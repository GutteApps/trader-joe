"use client";

import { useActionState, useState } from "react";
import { createPortfolioAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export default function CreatePortfolioForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createPortfolioAction,
    initial,
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02]"
      >
        + New portfolio
      </button>
    );
  }

  return (
    <form
      action={action}
      className="card w-full max-w-md space-y-3 p-4 sm:w-[380px]"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">New portfolio</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-faint hover:text-text"
        >
          ✕
        </button>
      </div>

      <label className="block text-xs font-medium text-muted">
        Name
        <input
          name="name"
          required
          autoFocus
          placeholder="e.g. Claw Bot Alpha"
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-muted">
          Type
          <select
            name="type"
            defaultValue="FAKE"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="FAKE">Paper (fake)</option>
            <option value="REAL">Real money</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-muted">
          Currency
          <input
            name="baseCurrency"
            defaultValue="USD"
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>
      </div>

      {state.error ? (
        <p className="text-xs text-loss">{state.error}</p>
      ) : null}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create portfolio"}
      </button>
    </form>
  );
}
