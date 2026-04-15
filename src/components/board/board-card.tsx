import Link from "next/link";
import { Users } from "lucide-react";
import { BoardCardActions } from "./board-card-actions";

// ──────────────────────────────────────────────
// Board Card — Individual Board in the Grid
// ──────────────────────────────────────────────
// Mostly a Server Component for performance, with a small
// Client Component island (BoardCardActions) for interactivity.
//
// Each card shows:
// - A colored top accent bar (the board's color)
// - Board title and description preview
// - Member count
// - "..." dropdown menu (edit/delete) — appears on hover
//
// Clicking the card navigates to /boards/[id] (Phase 3).

interface BoardCardProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    color: string;
    _count: {
      members: number;
    };
  };
  // Is the current user the owner of this board?
  // Passed down so we know whether to show the delete option.
  isOwner: boolean;
}

export function BoardCard({ board, isOwner }: BoardCardProps) {
  // BoardCardActions is a SIBLING of Link, not a child. If it were nested
  // inside Link, React synthetic events from the portalled dropdown would
  // bubble through the component tree to Link's onClick and trigger
  // navigation when clicking menu items. Keeping it outside sidesteps this.
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/boards/${board.id}`} className="block">
        {/* ─── Color Accent Bar ───
          A thin colored bar at the top of the card.
          This gives each board a visual identity at a glance,
          like how Trello boards have background colors.
          The `style` prop is used because Tailwind can't handle
          dynamic values (the color comes from the database). */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: board.color }}
        />

        {/* ─── Card Content ─── */}
        <div className="p-4">
          <h3 className="font-semibold tracking-tight group-hover:text-primary transition-colors">
            {board.title}
          </h3>

          {board.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {/*
                line-clamp-2: CSS trick that truncates text after 2 lines
                and adds "..." at the end. Prevents long descriptions from
                breaking the grid layout.
              */}
              {board.description}
            </p>
          )}

          {/* ─── Footer: Member Count ─── */}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {board._count.members}{" "}
              {board._count.members === 1 ? "member" : "members"}
            </span>
          </div>
        </div>
      </Link>

      {/* ─── Actions Dropdown ───
          Rendered outside the Link so menu clicks never bubble into it. */}
      <BoardCardActions board={board} isOwner={isOwner} />
    </div>
  );
}
