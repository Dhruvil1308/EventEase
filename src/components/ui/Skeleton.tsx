export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-xl bg-white/[0.04] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent ${className}`}
    />
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-3xl p-6 glass">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-6 h-8 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-10 h-2 w-full" />
          <div className="mt-6 flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className = "h-96" }: { className?: string }) {
  return (
    <div className={`rounded-3xl p-6 glass ${className}`} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-6 h-10 w-2/3" />
      <Skeleton className="mt-4 h-4 w-1/2" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
