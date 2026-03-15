import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";

// ──────────────────────────────────────────────
// Dashboard Layout — Authenticated App Shell
// ──────────────────────────────────────────────
// This layout wraps ALL authenticated pages (boards, settings, etc.).
// It provides the consistent UI shell: navbar on top, content below.
//
// WHY THIS IS A SERVER COMPONENT:
// - It calls auth() to get the session (server-only function)
// - It redirects unauthenticated users (server-side redirect is faster)
// - It passes user data down to the Navbar (Client Component)
//
// HOW ROUTE GROUPS WORK:
// The folder is called "(dashboard)" with parentheses.
// Next.js sees parentheses and says: "This is a route group —
// use it to organize files and share layouts, but DON'T add it
// to the URL path."
//
// So the file tree:
//   src/app/(dashboard)/boards/page.tsx
// Maps to the URL:
//   /boards    ← NOT /dashboard/boards
//
// This is the same pattern we used with (auth) for login/register.
// The benefit: auth pages get a centered-card layout, while
// dashboard pages get this navbar layout. Two different shells,
// both organized cleanly.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Defense in depth: middleware should catch this,
  // but if somehow an unauthenticated request reaches here, redirect.
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Navbar ───
        We pass the user object from the session.
        The Navbar is a Client Component (needs interactivity),
        but it receives its data from this Server Component.
        This pattern is called "lifting data up" — the server
        fetches, the client displays. */}
      <Navbar user={session.user} />

      {/* ─── Page Content ───
        The `children` slot is where the actual page renders.
        For /boards, this will be the boards page.
        For /boards/[id], this will be the board detail page (Phase 2).

        max-w-7xl centers the content with a max width (1280px).
        This prevents content from stretching across ultra-wide monitors. */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
