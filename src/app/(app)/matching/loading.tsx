import { Skeleton } from "@/components/ui/skeleton";

export default function MatchingLoading() {
  return (
    <>
      <div className="flex items-end justify-between pb-5">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-7 w-36" />
      </div>
      <Skeleton className="mb-5 h-11 w-80 max-w-full" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-9 w-full" />
          </div>
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
