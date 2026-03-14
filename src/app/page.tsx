import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

// ──────────────────────────────────────────────
// Home Page (Root Route: /)
// ──────────────────────────────────────────────
// For now, the root URL just redirects:
// - Logged in → /boards (dashboard)
// - Not logged in → /login
//
// Later, you could make this a landing page with a "Get Started" button.
// But for a collaborative task board, going straight to the app makes sense.

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/boards");
  } else {
    redirect("/login");
  }
}
