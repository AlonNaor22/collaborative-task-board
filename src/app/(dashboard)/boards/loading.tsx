import { Skeleton } from "@/components/ui/skeleton";

// ──────────────────────────────────────────────
// Boards Page Loading Skeleton
// ──────────────────────────────────────────────
// Next.js automatically shows this component while the boards page's
// Server Component is fetching data. Under the hood, Next.js wraps
// your page in a React Suspense boundary with this as the fallback.
//
// WHY A SEPARATE FILE (not inline)?
// Next.js has a file-system convention: if `loading.tsx` exists next
// to a `page.tsx`, it's used as the loading state. No imports needed,
// no Suspense boundaries to set up — just drop the file in.
//
// The skeleton mimics the actual page layout:
// - A header area (title + subtitle)
// - A 3-column grid of card-shaped skeletons
// This prevents "layout shift" — the skeleton has the same dimensions
// as the real content, so nothing jumps when data arrives.

export default function BoardsLoading() {
  return (
    <div className="space-y-6">
      {/* ─── Header Skeleton ─── */}
      <div>
        <Skeleton className="h-8 w-64" /> {/* "Welcome back, Alice!" */}
        <Skeleton className="mt-2 h-4 w-96" /> {/* subtitle text */}
      </div>

      {/* ─── Board Grid Skeleton ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Create board placeholder */}
        <Skeleton className="h-[120px] rounded-lg border border-dashed" />

        {/* Board card skeletons — match the real BoardCard structure */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border bg-card shadow-sm"
          >
            <Skeleton className="h-2 w-full rounded-none" /> {/* color bar */}
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" /> {/* title */}
              <Skeleton className="h-4 w-full" /> {/* description line 1 */}
              <Skeleton className="h-4 w-1/2" /> {/* description line 2 */}
              <Skeleton className="mt-3 h-3 w-20" /> {/* member count */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
