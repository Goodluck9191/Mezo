import { WorkspaceLoadingSkeleton } from "@/components/restaurant/workspace-loading-skeleton";

export default function Loading() {
  return (
    <main id="main" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <WorkspaceLoadingSkeleton />
    </main>
  );
}
