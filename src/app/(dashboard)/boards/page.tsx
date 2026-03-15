import { auth } from "@/server/auth";
import { serverTRPC } from "@/trpc/server";
import { BoardCard } from "@/components/board/board-card";
import { CreateBoardDialog } from "@/components/board/create-board-dialog";

// ──────────────────────────────────────────────
// Boards Page — "Your Boards" Dashboard
// ──────────────────────────────────────────────
// This is the main page users see after logging in.
// It fetches the user's boards from the database and
// renders them in a responsive grid.
//
// DATA FETCHING PATTERN:
// This is a Server Component, so we call tRPC DIRECTLY
// on the server (no HTTP request needed). The flow is:
//
//   1. User visits /boards
//   2. Next.js runs this component on the server
//   3. serverTRPC() creates a tRPC caller with the user's session
//   4. trpc.board.list() queries the database directly
//   5. The result is rendered into HTML and sent to the browser
//
// The browser never sees the tRPC call — it just gets the
// finished HTML. This is faster than client-side fetching
// because there's no network roundtrip for the data.
//
// WHEN DOES CLIENT-SIDE FETCHING HAPPEN?
// When the user creates/edits/deletes a board, the Client
// Components (CreateBoardDialog, EditBoardDialog) use tRPC
// mutations which DO go over HTTP. After the mutation succeeds,
// they call router.refresh() which re-runs THIS server component
// to get fresh data.

export default async function BoardsPage() {
  const session = await auth();
  const trpc = await serverTRPC();
  const boards = await trpc.board.list();

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name}!
        </h2>
        <p className="text-muted-foreground">
          Here are your boards. Create a new one or jump into an existing board.
        </p>
      </div>

      {/* ─── Board Grid ───
        The grid contains:
        1. A "Create Board" card (always first) — Client Component with dialog
        2. All existing boards — with Client Component islands for actions

        We put everything in a single CSS grid so the "Create" card
        aligns perfectly with the board cards.

        Responsive columns:
        - 1 column on mobile (< 640px)
        - 2 columns on tablets (640px+)
        - 3 columns on desktop (1024px+)
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Create Board Card — always visible as the first item */}
        <CreateBoardDialog />

        {/* Existing Board Cards */}
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            isOwner={board.ownerId === session?.user?.id}
          />
        ))}
      </div>

      {/* Show hint if no boards exist yet */}
      {boards.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Click &quot;Create Board&quot; above to get started!
        </p>
      )}
    </div>
  );
}
