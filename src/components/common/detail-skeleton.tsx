import { Skeleton } from "@/components/ui/skeleton";

/** Generisches Skelett für Detailseiten — sofortiges Feedback beim Navigieren. */
export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="ml-auto h-4 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-5">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-9 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
