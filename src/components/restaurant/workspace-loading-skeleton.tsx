import { Skeleton } from "@/components/ui/skeleton";

/** Generic skeleton mirroring the workspace pages: heading, badges, panels. */
export function WorkspaceLoadingSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-44 rounded-3xl xl:col-span-2" />
        <Skeleton className="h-44 rounded-3xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
}
