import { BoardCard } from "./board-card";

// ──────────────────────────────────────────────
// Board List — CSS Grid of Board Cards
// ──────────────────────────────────────────────
// Renders all boards in a responsive grid layout.
// Also shows an empty state when the user has no boards.
//
// CSS Grid vs Flexbox:
// Grid is better for this because we want a consistent
// column-based layout where all cards are the same width.
// Flexbox wraps items but doesn't guarantee equal columns.
//
// The responsive classes:
// - grid-cols-1: 1 column on mobile (< 640px)
// - sm:grid-cols-2: 2 columns on small screens (640px+)
// - lg:grid-cols-3: 3 columns on large screens (1024px+)

interface BoardListProps {
  boards: {
    id: string;
    title: string;
    description: string | null;
    color: string;
    ownerId: string;
    _count: {
      members: number;
    };
  }[];
  // The current user's ID, used to determine which boards they own
  currentUserId: string;
}

export function BoardList({ boards, currentUserId }: BoardListProps) {
  if (boards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          You don&apos;t have any boards yet. Create one to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          isOwner={board.ownerId === currentUserId}
        />
      ))}
    </div>
  );
}
