import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

// ──────────────────────────────────────────────
// Boards Page (Placeholder)
// ──────────────────────────────────────────────
// This is a temporary placeholder so that login/register have
// somewhere to redirect to. We'll build the real dashboard in Step 6.
//
// This is a Server Component — it runs on the server and can call
// auth() directly to get the current session. No hooks needed.

export default async function BoardsPage() {
  const session = await auth();

  // Double-check: if somehow accessed without auth, redirect to login.
  // (Middleware should catch this, but defense in depth is good practice.)
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Welcome, {session.user.name}!</h1>
      <p className="text-muted-foreground">
        You&apos;re logged in as {session.user.email}
      </p>
      <p className="text-sm text-muted-foreground">
        (Dashboard coming in Step 6)
      </p>
    </div>
  );
}
