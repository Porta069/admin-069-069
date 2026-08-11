import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignDetailLoading() {
  return (
    <>
      <div className="flex items-start justify-between pb-5">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-72 max-w-full" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="mt-3 h-2 w-full rounded-full" />
            <Skeleton className="mt-3 h-3 w-64" />
          </div>
          <div>
            <Skeleton className="mb-3 h-4 w-24" />
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-40" />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3.5">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="border-b px-5 py-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          </div>
          <div className="space-y-2.5 px-5 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-full" />
            ))}
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </>
  );
}
