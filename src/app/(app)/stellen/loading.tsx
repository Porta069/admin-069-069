import { Skeleton } from "@/components/ui/skeleton";

export default function StellenLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2 pb-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="ml-auto h-9 w-28" />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
