// Shown instantly while the portfolio detail page fetches (DB + live prices +
// benchmark). Mirrors the real layout so navigation feels smooth.

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className}`}
      style={{ opacity: 0.7 }}
    />
  );
}

export default function PortfolioLoading() {
  return (
    <div className="space-y-8">
      {/* header */}
      <div>
        <Block className="h-4 w-24" />
        <Block className="mt-3 h-7 w-56" />
      </div>

      {/* metrics */}
      <div className="card grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Block className="h-3 w-20" />
            <Block className="h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* performance chart */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <Block className="h-4 w-40" />
              <Block className="h-8 w-28" />
            </div>
            <Block className="h-[240px] w-full" />
          </section>

          {/* holdings */}
          <section className="card p-5">
            <Block className="h-4 w-24" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Block className="h-5 w-32" />
                  <Block className="h-5 w-20" />
                  <Block className="h-5 w-24" />
                </div>
              ))}
            </div>
          </section>

          {/* per-asset charts */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Block className="h-5 w-16" />
                  <Block className="h-5 w-20" />
                </div>
                <Block className="h-[160px] w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <Block className="h-4 w-28" />
            <Block className="h-10 w-full" />
            <Block className="h-10 w-full" />
            <Block className="h-10 w-full" />
            <Block className="h-10 w-full" />
          </section>
          <section className="card space-y-4 p-5">
            <Block className="h-4 w-24" />
            <div className="flex items-center gap-4">
              <Block className="h-[140px] w-[140px] rounded-full" />
              <div className="flex-1 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Block key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* trade history */}
      <section className="card p-5">
        <Block className="h-4 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Block key={i} className="h-6 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
