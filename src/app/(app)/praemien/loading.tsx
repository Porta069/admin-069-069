import { Skeleton } from "@/components/ui/skeleton";

export default function RewardsLoading() {
  return (
    <>
      <div className="pb-5">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mb-5 h-14 w-full" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-7 w-24" />
            <Skeleton className="mt-2.5 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
