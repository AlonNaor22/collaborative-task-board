import { Skeleton } from "@/components/ui/skeleton";

// ──────────────────────────────────────────────
// Board Detail Page Loading Skeleton
// ──────────────────────────────────────────────
// Shown while the Server Component fetches the board data.
// Mimics the board header + kanban column layout.

export default function BoardDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* ─── Board Header Skeleton ─── */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-16" /> {/* "Boards" back link */}
        <Skeleton className="h-4 w-4 rounded-full" /> {/* color dot */}
        <Skeleton className="h-7 w-48" /> {/* board title */}
        <Skeleton className="h-5 w-16 rounded-full" /> {/* role badge */}
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" /> {/* Members button */}
          <Skeleton className="h-8 w-20 rounded-md" /> {/* Invite button */}
        </div>
      </div>

      {/* ─── Kanban Columns Skeleton ─── */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[3, 2, 1].map((cardCount, colIndex) => (
          <div
            key={colIndex}
            className="w-72 flex-shrink-0 rounded-lg border bg-muted/30 p-3"
          >
            {/* Column header */}
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-24" /> {/* column title */}
              <Skeleton className="h-5 w-5 rounded" /> {/* count badge */}
            </div>

            {/* Card skeletons */}
            <div className="space-y-2">
              {Array.from({ length: cardCount }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="rounded-md border bg-card p-3 space-y-2"
                >
                  <Skeleton className="h-4 w-full" /> {/* card title */}
                  {cardIndex === 0 && (
                    <Skeleton className="h-3 w-2/3" /> /* description hint */
                  )}
                  <div className="flex gap-1">
                    <Skeleton className="h-4 w-12 rounded-full" /> {/* label */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
