import { Skeleton } from "@/components/ui/skeleton";

export default function KandidatenLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between pb-1">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
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
