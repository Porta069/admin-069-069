import { Skeleton } from "@/components/ui/skeleton";

export default function NewCampaignLoading() {
  return (
    <>
      <div className="flex items-end justify-between pb-5">
        <div>
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 border-b px-5 py-3.5">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-3 p-5">
                <Skeleton className="h-9 w-full max-w-md" />
                {i === 2 && <Skeleton className="h-32 w-full" />}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-8 w-20" />
            <Skeleton className="mt-3 h-4 w-40" />
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="mt-2 h-9 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
