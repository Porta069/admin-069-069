import { Skeleton } from "@/components/ui/skeleton";

export default function BankLoading() {
  return (
    <>
      <div className="flex items-end justify-between pb-5">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="mb-5 h-16 w-full" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-7 w-24" />
            <Skeleton className="mt-2.5 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
