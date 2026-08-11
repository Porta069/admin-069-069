import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <div className="pb-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-44" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-7 w-16" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-52 w-full" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mt-7 mb-3 h-5 w-32" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
