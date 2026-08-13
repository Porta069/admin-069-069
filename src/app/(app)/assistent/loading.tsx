import { Skeleton } from "@/components/ui/skeleton";

export default function AssistentLoading() {
  return (
    <>
      <div className="flex items-end justify-between pb-5">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="flex min-h-[60vh] flex-col rounded-lg border bg-card">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <Skeleton className="size-12 rounded-xl" />
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="mt-2 grid w-full max-w-xl gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="border-t p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
