import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { serverTRPC } from "@/trpc/server";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BoardMembersDialog } from "@/components/board/board-members-dialog";
import { InviteBoardDialog } from "@/components/board/invite-board-dialog";

// ──────────────────────────────────────────────
// Board Detail Page — /boards/[id]
// ──────────────────────────────────────────────
// This Server Component:
//   1. Reads the board ID from the URL params
//   2. Fetches the board (including the user's membership/role)
//   3. If the board doesn't exist or the user isn't a member → 404
//   4. Renders the board header + hands off to KanbanBoard (Client Component)
//
// WHY SERVER COMPONENT?
// The board metadata (title, color, user's role) is static — it doesn't
// change while the user is on the page. Fetching it on the server means:
//   - No loading spinner for the header
//   - The page is fully rendered before the browser sees it (better SEO, LCP)
//
// The Kanban board itself (columns + cards + drag-and-drop) must be a
// Client Component because it uses React state, effects, and event handlers.
// So we have a classic Next.js split:
//   Server: fetch data, render header
//   Client: interactive board

// Next.js passes URL params to the page as `params`.
// For a route like /boards/[id], params will be { id: "cuid..." }.
// In Next.js 15+, params is a Promise (async params) — we must await it.
interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { id } = await params;

  const session = await auth();
  const trpc = await serverTRPC();

  // Fetch the board. The router already checks membership —
  // if the user isn't a member, it throws NOT_FOUND.
  let board;
  try {
    board = await trpc.board.getById({ id });
  } catch {
    // Board not found OR user not a member → show 404
    notFound();
  }

  // Find the current user's role on this board.
  // We use this to conditionally show "Add column" / "Delete column" buttons.
  const userMembership = board.members.find(
    (m) => m.userId === session?.user?.id
  );
  const userRole = userMembership?.role ?? "MEMBER";

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Board Header ─── */}
      <div className="flex items-center gap-3">
        {/* Back to dashboard */}
        <Link
          href="/boards"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Boards
        </Link>

        {/* Board color dot + title */}
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: board.color ?? "#6b7280" }}
          />
          <h1 className="text-xl font-bold tracking-tight">{board.title}</h1>
        </div>

        {/* Role badge */}
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {userRole.charAt(0) + userRole.slice(1).toLowerCase()}
        </span>

        {/* Phase 7: Member management + Invite buttons (pushed to the right) */}
        <div className="ml-auto flex items-center gap-2">
          <BoardMembersDialog boardId={id} currentUserRole={userRole} />
          {(userRole === "OWNER" || userRole === "ADMIN") && (
            <InviteBoardDialog boardId={id} />
          )}
        </div>
      </div>

      {/* ─── Kanban Board (Client Component) ───
        We pass boardId and userRole as props — the Server Component
        "transfers" data to the Client Component this way.
        No tRPC call needed in the client for this — the board metadata
        is already known at render time.
      */}
      <KanbanBoard boardId={id} userRole={userRole} currentUserId={session?.user?.id ?? ""} />
    </div>
  );
}
