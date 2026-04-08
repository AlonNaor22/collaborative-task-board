import Link from "next/link";
import { FileQuestion } from "lucide-react";

// ──────────────────────────────────────────────
// Custom 404 — Page Not Found
// ──────────────────────────────────────────────
// Shown when a user navigates to a URL that doesn't match any route,
// or when a Server Component calls `notFound()` (like our board detail
// page does when the board doesn't exist or the user isn't a member).
//
// WHY CUSTOMIZE?
// The default Next.js 404 is a plain white page with small text.
// A custom one maintains the app's design language and helps users
// navigate back to a useful page.

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t
          have access to it.
        </p>
      </div>

      <Link
        href="/boards"
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to Boards
      </Link>
    </div>
  );
}
