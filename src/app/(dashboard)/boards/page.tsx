import { auth } from "@/server/auth";

// ──────────────────────────────────────────────
// Boards Page — "Your Boards" Dashboard
// ──────────────────────────────────────────────
// This is the main page users see after logging in.
// For now it's a placeholder — Phase 2 will add:
// - A grid of board cards
// - "Create new board" button
// - Board search/filter
//
// WHAT CHANGED FROM THE OLD VERSION:
// Before, this page lived at src/app/boards/page.tsx and had to:
// 1. Call auth() itself to check if the user was logged in
// 2. Redirect to /login if not
// 3. Render its own full-page layout (centered, min-h-screen)
//
// Now it lives inside (dashboard)/boards/ and the parent
// layout.tsx handles ALL of that. This page just focuses on
// content. This is the power of nested layouts in Next.js —
// each layout handles one concern, and pages stay simple.
//
// We still call auth() here to get the user's name for the
// welcome message. This is cheap — auth() reads the JWT cookie,
// no database query needed. The session is likely already cached
// from the layout's auth() call in the same request.

export default async function BoardsPage() {
  const session = await auth();

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

      {/* ─── Boards Grid (Placeholder) ─── */}
      {/*
        In Phase 2, this will be a CSS Grid of board cards.
        Each card will show: board name, member count, last updated.
        Plus a "Create new board" card with a + icon.
        For now, we show a placeholder to prove the layout works.
      */}
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          Your boards will appear here. (Coming in Phase 2)
        </p>
      </div>
    </div>
  );
}
