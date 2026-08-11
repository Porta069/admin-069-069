import { Skeleton } from "@/components/ui/skeleton";

export default function AffiliateLoading() {
  return (
    <>
      <div className="pb-5">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-7 w-20" />
            <Skeleton className="mt-2.5 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mb-4 flex gap-4 border-b pb-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
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
