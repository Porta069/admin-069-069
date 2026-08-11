import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2 pb-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Skeleton className="h-[70vh] rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-72" />
    </div>
  );
}
